import { useEffect, useState } from 'react';

interface SocialSummary {
  covenCount: number;
  pendingRequests: number;
  followerCount: number;
}

export function useSocialSummary(enabled = true) {
  const [summary, setSummary] = useState<SocialSummary | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await fetch('/api/account/social-summary', { signal: controller.signal, cache: 'no-store' });
        if (response.ok) {
          const next: SocialSummary = await response.json();
          if (!controller.signal.aborted) setSummary(next);
        }
      } catch {
        // Leave the last confirmed counts in place if a refresh fails.
      } finally {
        pending = false;
      }
    }

    void refresh();
    const timer = setInterval(() => { void refresh(); }, 15_000);
    window.addEventListener('focus', refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [enabled]);
  return summary;
}
