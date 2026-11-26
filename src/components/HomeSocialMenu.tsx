import { useEffect, useState } from 'react';
import { Bell, Compass, MessageSquare, Pencil, User } from 'lucide-react';
import { Link } from 'react-router';
import SparkItLink from '@/components/SparkItLink';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { COMMUNITY_FEED, COMMUNITY_CONNECTIONS, COMMUNITY_REQUESTS, HOME_EXPLORE } from '@/lib/community-navigation';

interface SocialSummary {
  covenCount: number;
  pendingRequests: number;
  followerCount: number;
}

export default function HomeSocialMenu({ username }: { username?: string | null }) {
  const [summary, setSummary] = useState<SocialSummary | null>(null);
  const profile = username ? `/u/${encodeURIComponent(username)}` : '/account/edit-profile';

  useEffect(() => {
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
  }, []);

  const stats = [
    { label: 'Coven', value: summary?.covenCount, to: COMMUNITY_CONNECTIONS },
    { label: 'Requests', value: summary?.pendingRequests, to: COMMUNITY_REQUESTS },
    { label: 'Followers', value: summary?.followerCount, to: profile },
  ];

  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-3xl">Home</h1>
        <div className="flex items-center gap-2">
          <SparkItLink />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Social menu" className="h-11 w-11 shrink-0 rounded-full">
                <User aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild><Link to={COMMUNITY_FEED}><MessageSquare aria-hidden="true" />Community</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to={HOME_EXPLORE}><Compass aria-hidden="true" />Explore</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to={COMMUNITY_REQUESTS}><Bell aria-hidden="true" />Coven requests</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              {username && <DropdownMenuItem asChild><Link to={profile}><User aria-hidden="true" />View my profile</Link></DropdownMenuItem>}
              <DropdownMenuItem asChild><Link to="/account/edit-profile"><Pencil aria-hidden="true" />{username ? 'Edit my profile' : 'Set up my profile'}</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <nav aria-label="Your social counts" className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card">
        {stats.map(({ label, value, to }) => (
          <Link key={label} to={to} className="coven-press rounded-lg px-2 py-2 text-center hover:bg-muted focus-visible:outline focus-visible:outline-primary">
            <span className="block text-base font-semibold tabular-nums text-foreground">{value?.toLocaleString() ?? '—'}</span>
            <span className="block text-xs text-muted-foreground">{label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
