import { afterEach, expect, it, vi } from 'vitest';

const { nativeRequest } = vi.hoisted(() => ({ nativeRequest: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => 'ios' },
  CapacitorHttp: { request: nativeRequest },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  nativeRequest.mockReset();
});

it('uses the same native transport for email sign-in and session lookup', async () => {
  const originalFetch = vi.fn();
  vi.stubGlobal('fetch', originalFetch);
  nativeRequest.mockResolvedValue({
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': 'private=value; HttpOnly' },
    data: { user: { id: 'test' } },
  });
  const { uploadedMediaUrl } = await import('../native-api');
  const signIn = await fetch('https://spellful.com/api/auth/sign-in/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email":"qa@example.invalid","password":"test fixture password"}',
  });
  expect(signIn.headers.has('set-cookie')).toBe(false);
  const session = await fetch('/api/auth/get-session');
  expect(await session.json()).toEqual({ user: { id: 'test' } });
  expect(nativeRequest.mock.calls.map(([request]) => request.method)).toEqual(['POST', 'GET']);
  expect(nativeRequest.mock.calls[0][0].headers.origin).toBe('https://spellful.com');
  await fetch('/api/conversations?limit=50');
  expect(nativeRequest.mock.calls[2][0].url).toBe('https://spellful.com/api/conversations?limit=50');
  expect(uploadedMediaUrl('/airo-assets/uploads/avatars/example.png'))
    .toBe('https://spellful.com/airo-assets/uploads/avatars/example.png');
  expect(uploadedMediaUrl('/assets/media/bundled.png')).toBe('/assets/media/bundled.png');
  expect(originalFetch).not.toHaveBeenCalled();
});
