import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSession } from './auth-client';

const { session } = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock('better-auth/react', () => ({ createAuthClient: () => ({ useSession: session }) }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  window.sessionStorage.clear();
});

it('retains the cookie through a slow or failed lookup and accepts a later healthy session', () => {
  vi.useFakeTimers();
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  session.mockReturnValue({ data: null, isPending: true });
  const hook = renderHook(useSession);
  act(() => { vi.advanceTimersByTime(12_000); });
  expect(fetch).not.toHaveBeenCalled();
  session.mockReturnValue({ data: null, isPending: false, error: { status: 503 } });
  hook.rerender();
  expect(fetch).not.toHaveBeenCalled();
  session.mockReturnValue({ data: { user: { id: 'member' } }, isPending: false });
  hook.rerender();
  expect(hook.result.current.isAuthenticated).toBe(true);
});
