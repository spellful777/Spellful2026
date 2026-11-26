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

/** Resolve saved user-upload URLs against the server on iOS. Bundled images,
 * external images, and local blob previews keep their original URLs. */
export function uploadedMediaUrl(url: string): string {
  if (Capacitor.getPlatform() === 'ios' && /^\/(?:airo-assets\/uploads|assets\/uploads|uploads)\//.test(url)) {
    return apiOrigin + url;
  }
  return url;
}

// Keep bundled assets local. Use the same native connection for auth reads
// and writes, including the session lookup immediately after sign-in.
async function fetchNativeJson(url: string, request: Request): Promise<Response> {
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
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.href);
    const local = url.protocol === window.location.protocol && url.host === window.location.host;
    const apiPath = url.pathname.startsWith('/api/');
    const authPath = url.pathname.startsWith('/api/auth/');
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const sessionRead = method === 'GET' &&
      /^\/api\/(conversations|messages|groups|presence|profile|keys)(?:\/|$)/.test(url.pathname);
    if ((authPath || sessionRead) && (local || url.origin === apiOrigin)) {
      const target = apiOrigin + url.pathname + url.search;
      const request = input instanceof Request ? new Request(input, init) : new Request(target, init);
      return fetchNativeJson(target, request);
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
