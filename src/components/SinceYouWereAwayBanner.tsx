/**
 * SinceYouWereAwayBanner
 *
 * Shown at the top of /community when the user returns after an absence and
 * there is new activity since their last visit. Displays a warm summary:
 *   "2 new messages · 5 new discussions since you were away"
 * Each item is a link to the correct destination. Dismissing the banner
 * advances the community feed cursor (clearing the new-posts count) but
 * does NOT mark DMs as read — those clear only when the user opens /messages.
 *
 * Visibility rules:
 * - Only shown when total > 0 (messages + requests + newPosts)
 * - Suppressed if the user has been on /community for > SUPPRESS_AFTER_MS
 *   (they've already seen the feed — no need to remind them)
 * - Dismissed state is kept in component state; re-appears on next page visit
 * - Advances the community cursor on dismiss so the badge also clears
 */
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageSquare, Sparkles } from 'lucide-react';

interface SinceYouWereAwayCounts {
  messages: number;
  requests: number;
  newPosts: number;
}

interface Props {
  /** Called when the user dismisses the banner — parent should advance the cursor */
  onDismiss: () => void;
}

const SUPPRESS_AFTER_MS = 90_000; // hide after 90 s on the page (they've seen the feed)

export default function SinceYouWereAwayBanner({ onDismiss }: Props) {
  const [counts, setCounts] = useState<SinceYouWereAwayCounts | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const mountedAtRef = useRef(Date.now());

  // Fetch counts once on mount — we want the snapshot at arrival, not a live poll
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/notifications/summary', { credentials: 'include' });
        if (!res.ok || cancelled) return;
        const data = await res.json() as SinceYouWereAwayCounts & { community: number; total: number };
        if (!cancelled) setCounts({ messages: data.messages, requests: data.requests, newPosts: data.newPosts });
      } catch { /* silent */ }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Auto-suppress after SUPPRESS_AFTER_MS
  useEffect(() => {
    const remaining = SUPPRESS_AFTER_MS - (Date.now() - mountedAtRef.current);
    if (remaining <= 0) { setDismissed(true); return; }
    const timer = setTimeout(() => setDismissed(true), remaining);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  // Nothing to show
  if (!counts) return null;
  const totalMessages = counts.messages + counts.requests;
  const hasMessages = totalMessages > 0;
  const hasPosts = counts.newPosts > 0;
  if (!hasMessages && !hasPosts) return null;
  if (dismissed) return null;

  // Build the summary items
  const items: { label: string; href: string; icon: React.ReactNode }[] = [];
  if (hasMessages) {
    items.push({
      label: totalMessages === 1 ? '1 new message' : `${totalMessages} new messages`,
      href: '/messages',
      icon: <MessageSquare size={13} strokeWidth={1.8} />,
    });
  }
  if (hasPosts) {
    items.push({
      label: counts.newPosts === 1 ? '1 new discussion' : `${counts.newPosts} new discussions`,
      href: '/community',
      icon: <Sparkles size={13} strokeWidth={1.8} />,
    });
  }

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="sywa-banner"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28, ease: 'easeOut' as const }}
          role="status"
          aria-label="Activity since your last visit"
          className="mx-5 md:mx-8 mt-6 mb-0 rounded-xl flex items-center gap-3 px-4 py-3"
          style={{
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--primary) / 0.3)',
            boxShadow: '0 2px 16px hsl(var(--primary) / 0.08)',
          }}
        >
          {/* Glow dot */}
          <span
            className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
            style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}
            aria-hidden="true"
          >
            <Sparkles size={14} strokeWidth={1.8} />
          </span>

          {/* Summary text */}
          <p
            className="flex-1 text-sm leading-snug flex flex-wrap items-center gap-x-1.5 gap-y-0.5"
            style={{ fontFamily: 'var(--font-sans)', color: 'hsl(var(--foreground))' }}
          >
            <span style={{ color: 'hsl(var(--muted-foreground))' }}>Since you were away —</span>
            {items.map((item, i) => (
              <span key={item.href} className="inline-flex items-center gap-1">
                {i > 0 && <span style={{ color: 'hsl(var(--muted-foreground))' }}>·</span>}
                <Link
                  to={item.href}
                  onClick={handleDismiss}
                  className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline transition-colors"
                  style={{ color: 'hsl(var(--primary))' }}
                >
                  {item.icon}
                  {item.label}
                </Link>
              </span>
            ))}
          </p>

          {/* Dismiss */}
          <button
            aria-label="Dismiss since-you-were-away summary"
            onClick={handleDismiss}
            className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-muted"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            <X size={13} strokeWidth={2} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
