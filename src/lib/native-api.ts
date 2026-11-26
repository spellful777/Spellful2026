import { Capacitor, CapacitorHttp } from '@capacitor/core';

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

// Keep bundled assets local. Use the same native connection for auth reads
// and writes, including the session lookup immediately after sign-in.
async function fetchNativeAuth(url: string, request: Request): Promise<Response> {
  const headers = new Headers(request.headers);
  headers.set('Origin', apiOrigin);
  const body = request.body ? await request.text() : undefined;
  const result = await CapacitorHttp.request({
    url,
    method: request.method,
    headers: Object.fromEntries(headers),
    data: body,
    connectTimeout: 20_000,
    readTimeout: 20_000,
  });
  const responseHeaders = new Headers(result.headers);
  responseHeaders.delete('set-cookie');
  responseHeaders.delete('set-cookie2');
  const content = request.method === 'HEAD' || [204, 205, 304].includes(result.status)
    ? null
    : responseHeaders.get('content-type')?.includes('application/json')
      ? JSON.stringify(result.data)
      : result.data;
  return new Response(content, { status: result.status, headers: responseHeaders });
}

if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'ios') {
  // Let the WebView keep the whole app below the status bar and outside the
  // home indicator, including screens with their own fixed or sticky headers.
  const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (viewport) viewport.content = viewport.content.replace('viewport-fit=cover', 'viewport-fit=contain');

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    const local = url.protocol === window.location.protocol && url.host === window.location.host;
    const apiPath = url.pathname.startsWith('/api/');
    const authPath = url.pathname.startsWith('/api/auth/');
    if (authPath && (local || url.origin === apiOrigin)) {
      const target = apiOrigin + url.pathname + url.search;
      const request = input instanceof Request ? new Request(input, init) : new Request(target, init);
      return fetchNativeAuth(target, request);
    }
    if (!local || !apiPath) return nativeFetch(input, init);
    const target = apiOrigin + url.pathname + url.search;
    if (input instanceof Request) {
      const request = new Request(input, init);
      return nativeFetch(new Request(target, request));
    }
    return nativeFetch(target, { credentials: 'include', ...init });
  };
}
