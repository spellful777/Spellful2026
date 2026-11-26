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
  const viewport = document.createElement('meta');
  viewport.name = 'viewport';
  viewport.content = 'width=device-width, viewport-fit=cover';
  document.head.append(viewport);
  const originalFetch = vi.fn();
  vi.stubGlobal('fetch', originalFetch);
  nativeRequest.mockResolvedValue({
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': 'private=value; HttpOnly' },
    data: { user: { id: 'test' } },
  });
  try {
    await import('../native-api');
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
    expect(originalFetch).not.toHaveBeenCalled();
    expect(viewport.content).toContain('viewport-fit=contain');
  } finally {
    viewport.remove();
  }
});
