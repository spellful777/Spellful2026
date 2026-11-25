/**
 * OnlineDot — shows a green dot when a user is online, grey when offline.
 * Polls /api/presence/:userId every 30 seconds unless presenceData is supplied
 * externally (e.g. from a batch fetch), in which case no individual request is made.
 */
import { useEffect, useState } from 'react';

export interface PresenceData {
  online: boolean;
  lastSeen: string | null;
}

interface Props {
  userId: string;
  /** Size in pixels (default 10) */
  size?: number;
  className?: string;
  /** Pre-fetched presence data — skips individual polling when provided */
  presenceData?: PresenceData | null;
}

export function OnlineDot({ userId, size = 10, className = '', presenceData }: Props) {
  const [presence, setPresence] = useState<PresenceData | null>(presenceData ?? null);

  useEffect(() => {
    // If presence was supplied externally, keep it in sync but don't poll
    if (presenceData !== undefined) {
      setPresence(presenceData ?? null);
      return;
    }

    let cancelled = false;

    async function fetchPresence() {
      try {
        const res = await fetch(`/api/presence/${userId}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json() as PresenceData;
        if (!cancelled) setPresence(data);
      } catch { /* silent */ }
    }

    void fetchPresence();
    const interval = setInterval(() => { void fetchPresence(); }, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [userId, presenceData]);

  if (!presence) return null;

  const title = presence.online
    ? 'Online now'
    : presence.lastSeen
      ? `Last seen ${formatRelative(presence.lastSeen)}`
      : 'Offline';

  return (
    <span
      className={`inline-block rounded-full flex-shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: presence.online ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))',
        boxShadow: presence.online ? '0 0 0 2px hsl(var(--card))' : undefined,
      }}
      title={title}
      aria-label={title}
    />
  );
}

function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
