import { Link, useLocation } from 'react-router';
import { BookOpen, Home, Search, User, Users } from 'lucide-react';
import { useSession } from '@/lib/auth/auth-client';
import { COMMUNITY_CONNECTIONS } from '@/lib/community-navigation';
import { useNotificationCounts } from '@/hooks/useNotificationCounts';
import { mobileDestination, type MobileDestination } from '@/lib/mobile-navigation';

const TABS = [
  { label: 'Explore', href: '/explore', Icon: Search, private: false },
  { label: 'Coven', href: COMMUNITY_CONNECTIONS, Icon: Users, private: true },
  { label: 'Home', href: '/', Icon: Home, private: false },
  { label: 'Grimoire', href: '/grimoire', Icon: BookOpen, private: true },
  { label: 'You', href: '/account', Icon: User, private: true },
] satisfies { label: MobileDestination; href: string; Icon: typeof Home; private: boolean }[];

export default function MobileBottomNav() {
  const { session, isPending } = useSession();
  const { pathname, search } = useLocation();
  const { counts } = useNotificationCounts();
  const active = mobileDestination(pathname, search);

  return <nav aria-label="Mobile bottom navigation" aria-hidden={isPending || undefined}
    data-home-palette={session && pathname === '/' ? true : undefined}
    className="fixed inset-x-0 bottom-0 z-50 grid min-h-14 grid-cols-5 border-t border-primary/20 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
    {!isPending && TABS.map(({ label, href, Icon, private: authRequired }) => {
      const selected = active === label;
      const badge = label === 'Coven' && session ? counts.total : 0;
      return <Link key={label} to={authRequired && !session ? '/login?redirect=' + encodeURIComponent(href) : href}
        aria-current={selected ? 'page' : undefined} aria-label={badge ? `${label}, ${badge} new activity` : label}
        className={`relative flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 focus-visible:outline focus-visible:outline-primary ${selected ? 'text-primary' : 'text-accent'}`}>
        {selected && <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-full bg-primary" aria-hidden="true" />}
        <span className="relative">
          <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
          {badge > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground" aria-hidden="true">{badge > 99 ? '99+' : badge}</span>}
        </span>
        <span className="text-[10px] font-medium leading-none">{label}</span>
      </Link>;
    })}
  </nav>;
}
