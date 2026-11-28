import { useEffect, useState, type Ref } from 'react';
import { ChevronRight, Bell, Compass, Pencil, Star, User, Users } from 'lucide-react';
import { Link } from 'react-router';
import { getMoonPhase, moonGlyph, type MoonPhaseName } from '@/lib/moon-phase-engine';
import { useSocialSummary } from '@/hooks/useSocialSummary';
import SparkItLink from '@/components/SparkItLink';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { COMMUNITY_CONNECTIONS, HOME_FEED, COMMUNITY_REQUESTS, COMMUNITY_FAVORITES, HOME_EXPLORE } from '@/lib/community-navigation';

function HomeMoonLink() {
  const [phase, setPhase] = useState<MoonPhaseName | null>(null);

  useEffect(() => {
    const updateMoon = () => setPhase(getMoonPhase().phase);
    updateMoon();
    const timer = setInterval(updateMoon, 60_000);
    window.addEventListener('focus', updateMoon);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', updateMoon);
    };
  }, []);

  return (
    <Link to="/moon-calendar" className="home-social-surface coven-press flex min-h-11 items-center gap-2 rounded-lg px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-primary">
      <span className="flex size-6 shrink-0 items-center justify-center text-xl leading-none" aria-hidden="true">{moonGlyph(phase ?? undefined)}</span>
      <span className="min-w-0 flex-1 font-semibold text-foreground">{phase ?? 'Moon calendar'}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

interface HomeSocialMenuProps {
  visitor: boolean;
  username?: string | null;
  sparkRef: Ref<HTMLAnchorElement>;
  floatingSpark: boolean;
}

export default function HomeSocialMenu({ visitor, username, sparkRef, floatingSpark }: HomeSocialMenuProps) {
  const pendingRequests = useSocialSummary(!visitor)?.pendingRequests ?? 0;
  const profile = username ? `/u/${encodeURIComponent(username)}` : '/account/edit-profile';
  return (
    <header className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h1 className="sr-only md:not-sr-only md:font-heading md:text-3xl">Sparks</h1>
        <Link to="/" aria-label="Spellful Home" className="home-brand relative inline-flex min-h-11 items-center rounded-sm focus-visible:outline focus-visible:outline-primary md:hidden">
          <img src="/assets/media/logo-official-white-8b86d830.png" alt="" width={82} height={44} className="block h-11 w-auto" />
        </Link>
        <div className="home-header-actions flex shrink-0 items-center gap-2.5">
          <SparkItLink linkRef={sparkRef} inactive={floatingSpark} />
          {visitor ? (
            <Link to={'/login?redirect=' + encodeURIComponent(HOME_FEED)} aria-label="Sign in to your Coven"
              className="inline-flex size-11 items-center justify-center rounded-md text-foreground focus-visible:outline focus-visible:outline-primary">
              <User className="size-5" strokeWidth={1.75} aria-hidden="true" />
            </Link>
          ) : <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={pendingRequests > 0 ? `Social menu, ${pendingRequests} pending Coven requests` : 'Social menu'}
                className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-md text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <User className="size-5" strokeWidth={1.75} aria-hidden="true" />
                {pendingRequests > 0 && (
                  <span aria-hidden="true" className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-background">
                    {pendingRequests}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="home-social-menu w-52 [&_[role=menuitem]]:min-h-11 [&_[role=menuitem]:focus]:text-background">
              <DropdownMenuItem asChild><Link to={COMMUNITY_CONNECTIONS}><Users aria-hidden="true" />My Coven</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to="/community/discover"><Compass aria-hidden="true" />Find members</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to={HOME_EXPLORE}><Compass aria-hidden="true" />Explore</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to={COMMUNITY_REQUESTS}><Bell aria-hidden="true" />Coven requests</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link to={COMMUNITY_FAVORITES}><Star aria-hidden="true" />Favorites</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              {username && <DropdownMenuItem asChild><Link to={profile}><User aria-hidden="true" />View my profile</Link></DropdownMenuItem>}
              <DropdownMenuItem asChild><Link to="/account/edit-profile"><Pencil aria-hidden="true" />{username ? 'Edit my profile' : 'Set up my profile'}</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      </div>

      <HomeMoonLink />
    </header>
  );
}
