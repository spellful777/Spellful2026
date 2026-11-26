export type MobileDestination = 'Explore' | 'Coven' | 'Home' | 'Grimoire' | 'You';
const belongsTo = (path: string, roots: string[]) => roots.some(root => path === root || path.startsWith(root + '/'));

export function mobileDestination(path: string, search = ''): MobileDestination {
  const params = new URLSearchParams(search);
  if (path === '/') return params.get('feed') === 'explore' ? 'Explore' : 'Home';
  if (path === '/login') {
    const redirect = params.get('redirect');
    if (redirect?.startsWith('/') && !redirect.startsWith('//')) {
      const target = new URL(redirect, 'https://spellful.com');
      if (target.pathname !== '/login') return mobileDestination(target.pathname, target.search);
    }
    return 'You';
  }
  if (belongsTo(path, ['/community/discover', '/community/search'])) return 'Explore';
  if (belongsTo(path, ['/community', '/messages'])) return 'Coven';
  if (belongsTo(path, ['/grimoire', '/dashboard', '/sanctuary', '/reminders', '/dream-journal', '/timeline', '/journal'])) return 'Grimoire';
  if (belongsTo(path, ['/account', '/profile', '/u', '/signup', '/plus', '/onboarding'])) return 'You';
  return 'Explore';
}
