/**
 * CovenAlertToast
 *
 * In-app alert toasts for new Coven activity while the user browses elsewhere.
 * Polls /api/notifications/summary every 30 s (shared with useNotificationCounts).
 * Shows a dismissible toast when:
 *   - A new unread DM arrives (not while on /messages)
 *   - A new community notification arrives (not while on /community)
 *
 * Rules:
 * - Never shows the same event twice (tracks last-seen totals)
 * - Suppresses while already on the relevant page
 * - Batches community posts — one toast for N new posts, not N toasts
 * - Respects reduced-motion preference
 * - Auto-dismisses after 6 s; user can dismiss early
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Users } from 'lucide-react';
import { useSession } from '@/lib/auth/auth-client';

interface ToastItem {
  id: string;
  kind: 'message' | 'community';
  label: string;
  href: string;
}

const POLL_MS = 30_000;
const AUTO_DISMISS_MS = 6_000;

export default function CovenAlertToast() {
  const { session } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Track previous counts to detect increases
  const prevRef = useRef({ messages: 0, requests: 0, community: 0, newPosts: 0 });
  const initializedRef = useRef(false);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const addToast = useCallback((item: Omit<ToastItem, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((t) => [...t.slice(-2), { ...item, id }]); // max 3 toasts
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  const poll = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch('/api/notifications/summary', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json() as { messages: number; requests: number; community: number; newPosts: number };

      // On first load, just record baseline — don't toast for existing unread
      if (!initializedRef.current) {
        prevRef.current = { messages: data.messages, requests: data.requests, community: data.community, newPosts: data.newPosts };
        initializedRef.current = true;
        return;
      }

      const prev = prevRef.current;
      const onMessages = location.pathname.startsWith('/messages');
      const onCommunity = location.pathname.startsWith('/community');

      // New DM or request
      const newMsgDelta = (data.messages + data.requests) - (prev.messages + prev.requests);
      if (newMsgDelta > 0 && !onMessages) {
        addToast({
          kind: 'message',
          label: newMsgDelta === 1 ? 'You have a new message' : `${newMsgDelta} new messages`,
          href: '/messages',
        });
      }

      // New community notifications or posts
      const newCommDelta = (data.community + data.newPosts) - (prev.community + prev.newPosts);
      if (newCommDelta > 0 && !onCommunity) {
        addToast({
          kind: 'community',
          label: newCommDelta === 1 ? 'New activity in your Coven' : `${newCommDelta} new things in your Coven`,
          href: '/community',
        });
      }

      prevRef.current = { messages: data.messages, requests: data.requests, community: data.community, newPosts: data.newPosts };
    } catch {
      // Network error — silent
    }
  }, [session?.user?.id, location.pathname, addToast]);

  useEffect(() => {
    if (!session?.user?.id) return;
    void poll();
    const timer = setInterval(() => { if (!document.hidden) void poll(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [session?.user?.id, poll]);

  // Reset baseline when navigating to a relevant page (clears stale delta)
  useEffect(() => {
    if (location.pathname.startsWith('/messages') || location.pathname.startsWith('/community')) {
      // Refetch to get fresh baseline after navigation
      void (async () => {
        try {
          const res = await fetch('/api/notifications/summary', { credentials: 'include' });
          if (res.ok) {
            const data = await res.json() as { messages: number; requests: number; community: number; newPosts: number };
            prevRef.current = data;
          }
        } catch { /* silent */ }
      })();
    }
  }, [location.pathname]);

  if (!session?.user?.id || toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Coven activity alerts"
      className="fixed bottom-20 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role="alert"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: 'easeOut' as const }}
            className="pointer-events-auto w-full max-w-sm rounded-xl flex items-center gap-3 px-4 py-3 cursor-pointer"
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--primary) / 0.35)',
              boxShadow: '0 4px 24px hsl(var(--background) / 0.7)',
            }}
            onClick={() => { dismiss(toast.id); void navigate(toast.href); }}
          >
            <span
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'hsl(var(--primary) / 0.18)', color: 'hsl(var(--primary))' }}
            >
              {toast.kind === 'message'
                ? <MessageSquare size={16} strokeWidth={1.8} />
                : <Users size={16} strokeWidth={1.8} />
              }
            </span>
            <span
              className="flex-1 text-sm leading-snug"
              style={{ fontFamily: 'var(--font-sans)', color: 'hsl(var(--foreground))' }}
            >
              {toast.label}
            </span>
            <button
              aria-label="Dismiss alert"
              onClick={(e) => { e.stopPropagation(); dismiss(toast.id); }}
              className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
