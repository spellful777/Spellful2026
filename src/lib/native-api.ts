import { Capacitor } from '@capacitor/core';

function iosApiOrigin(): string {
  const url = new URL(import.meta.env.VITE_IOS_API_ORIGIN || 'https://spellful.com');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_IOS_API_ORIGIN must be an HTTPS origin');
  }
  return url.origin;
}

export const apiOrigin = Capacitor.getPlatform() === 'ios'
  ? iosApiOrigin()
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
