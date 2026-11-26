import { useEffect, useState } from 'react';
import { ArrowUpRight, Bell, Compass, MessageSquare, Pencil, User } from 'lucide-react';
import { Link } from 'react-router';
import { getMoonPhase, moonGlyph, type MoonPhaseResult } from '@/lib/moon-phase-engine';
import SparkItLink from '@/components/SparkItLink';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { COMMUNITY_FEED, COMMUNITY_CONNECTIONS, COMMUNITY_REQUESTS, HOME_EXPLORE } from '@/lib/community-navigation';

function HomeMoonLink() {
  const [moon, setMoon] = useState<MoonPhaseResult | null>(null);

  useEffect(() => {
    const updateMoon = () => setMoon(getMoonPhase());
    updateMoon();
    const timer = setInterval(updateMoon, 60_000);
    window.addEventListener('focus', updateMoon);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', updateMoon);
    };
  }, []);

  return (
    <Link to="/moon-calendar" className="home-social-surface coven-press flex min-h-11 items-center gap-2 rounded-lg px-3 py-1.5 text-xs focus-visible:outline focus-visible:outline-primary">
      <span className="flex size-6 shrink-0 items-center justify-center text-xl leading-none" aria-hidden="true">{moonGlyph(moon?.phase)}</span>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-semibold text-foreground">{moon?.phase ?? 'Moon calendar'}</span>
        {moon && <span className="text-muted-foreground">{moon.illumination}% illuminated</span>}
      </span>
      <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

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
    <header className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="sr-only md:not-sr-only md:font-heading md:text-3xl">Home</h1>
        <Link to="/" aria-label="Spellful Home" className="home-brand relative inline-flex min-h-11 items-center rounded-sm focus-visible:outline focus-visible:outline-primary md:hidden">
          <img src="/airo-assets/images/logo/official-white" alt="" width={82} height={44} className="block h-11 w-auto" />
        </Link>
        <div className="flex items-center gap-2">
          <SparkItLink />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Social menu" className="home-social-surface h-11 w-11 shrink-0 rounded-full">
                <User aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="home-social-menu w-52 [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]:focus]:text-background">
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

      <HomeMoonLink />

      <nav aria-label="Your social counts" className="home-social-surface grid grid-cols-3 divide-x divide-border rounded-lg">
        {stats.map(({ label, value, to }) => (
          <Link key={label} to={to} className="coven-press rounded-lg px-2 py-1.5 text-center hover:bg-muted focus-visible:outline focus-visible:outline-primary">
            <span className="block text-base font-semibold tabular-nums text-foreground">{value?.toLocaleString() ?? '—'}</span>
            <span className="block text-xs text-muted-foreground">{label}</span>
          </Link>
        ))}
      </nav>
    </header>
  );
}
