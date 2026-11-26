/**
 * CommunityStatsInline — compact one-line stats for the signed-in community nav bar.
 * Shows: green dot + "N witch(es) online" | users icon + "N member(s)"
 * The online count is tappable to show a brief tooltip.
 */
import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';

interface CommunityStats { onlineCount: number; registeredCount: number; }

export default function CommunityStatsInline() {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [showTip, setShowTip] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/community/stats');
        if (!res.ok) return;
        const data: CommunityStats = await res.json();
        if (!cancelled) setStats(data);
      } catch { /* non-fatal */ }
    }
    void load();
    const interval = setInterval(() => { void load(); }, 60_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const onlineLabel = stats
    ? stats.onlineCount === 1
      ? '1 witch online'
      : stats.onlineCount.toLocaleString() + ' witches online'
    : null;

  const memberLabel = stats
    ? stats.registeredCount === 1
      ? '1 member'
      : stats.registeredCount.toLocaleString() + ' members'
    : null;

  return (
    <div className="flex items-center gap-3" aria-label="Community statistics">
      {/* Online count — tappable */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowTip((v) => !v)}
          className="flex items-center gap-1.5 focus:outline-none group"
          aria-label="See who is online"
        >
          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[hsl(var(--success))]" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--success))]" />
          </span>
          {onlineLabel === null ? (
            <span className="h-3 w-20 rounded animate-pulse inline-block bg-muted" />
          ) : (
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
              {onlineLabel}
            </span>
          )}
        </button>

        {showTip && (
          <div className="absolute top-full left-0 mt-1.5 z-50 rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap bg-card border border-border text-muted-foreground">
            Detailed online list coming soon
          </div>
        )}
      </div>

      <span className="w-px h-3.5 shrink-0 bg-border" aria-hidden="true" />

      {/* Member count */}
      <div className="flex items-center gap-1.5">
        <Users className="w-3 h-3 shrink-0 text-accent" aria-hidden="true" />
        {memberLabel === null ? (
          <span className="h-3 w-16 rounded animate-pulse inline-block bg-muted" />
        ) : (
          <span className="text-xs text-muted-foreground">
            {memberLabel}
          </span>
        )}
      </div>
    </div>
  );
}
