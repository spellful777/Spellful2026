/**
 * useNotificationCounts
 *
 * Polls GET /api/notifications/summary every POLL_INTERVAL ms while the user
 * is authenticated and the tab is visible. Returns the latest counts and a
 * manual refresh function.
 *
 * Pauses polling when the tab is hidden to save bandwidth.
 * Refreshes immediately on tab focus after a period of inactivity.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from '@/lib/auth/auth-client';

const POLL_INTERVAL = 30_000; // 30 seconds
const FOCUS_REFRESH_THRESHOLD = 60_000; // refresh on focus if away > 1 min

export interface NotificationCounts {
  messages: number;
  requests: number;
  community: number;
  newPosts: number;
  total: number;
}

const ZERO: NotificationCounts = { messages: 0, requests: 0, community: 0, newPosts: 0, total: 0 };

export function useNotificationCounts() {
  const { session } = useSession();
  const [counts, setCounts] = useState<NotificationCounts>(ZERO);
  const lastFetchRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch('/api/notifications/summary', { credentials: 'include' });
      if (res.ok) {
        const data = (await res.json()) as NotificationCounts;
        setCounts(data);
        lastFetchRef.current = Date.now();
      }
    } catch {
      // Network error — keep stale counts, retry on next interval
    }
  }, [session?.user?.id]);

  // Start/stop polling based on auth state
  useEffect(() => {
    if (!session?.user?.id) {
      setCounts(ZERO);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    void fetchCounts();
    timerRef.current = setInterval(() => {
      if (!document.hidden) void fetchCounts();
    }, POLL_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [session?.user?.id, fetchCounts]);

  // Refresh on tab focus if away long enough
  useEffect(() => {
    function onFocus() {
      if (session?.user?.id && Date.now() - lastFetchRef.current > FOCUS_REFRESH_THRESHOLD) {
        void fetchCounts();
      }
    }
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) onFocus();
    });
    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [session?.user?.id, fetchCounts]);

  return { counts, refresh: fetchCounts };
}
