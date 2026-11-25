import { Capacitor } from '@capacitor/core';

export const apiOrigin = Capacitor.getPlatform() === 'ios'
  ? 'https://spellful.com'
  : typeof window === 'undefined' ? '' : window.location.origin;

// Keep bundled assets local. Send API requests through Capacitor's native
// HTTP implementation so authenticated requests share its cookie store.
if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'ios') {
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    if (url.protocol !== window.location.protocol || url.host !== window.location.host ||
        !url.pathname.startsWith('/api/')) return nativeFetch(input, init);
    const target = apiOrigin + url.pathname + url.search;
    if (input instanceof Request) {
      const request = new Request(input, init);
      return nativeFetch(new Request(target, request));
    }
    return nativeFetch(target, { credentials: 'include', ...init });
  };
}
