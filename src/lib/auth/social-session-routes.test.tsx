import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import CommunityPage from '../../pages/community/index';
import HomePage from '../../pages/index';

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('better-auth/react', () => ({ createAuthClient: () => ({ useSession: lookup }) }));

afterEach(cleanup);

function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <output>{pathname}{search}</output>;
}

function openPage(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <CurrentLocation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/login" element={<p>Sign in</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const memberRoutes = ['/?feed=following', '/community?view=coven'];

it.each(memberRoutes)('keeps %s open when the session service is unavailable', (path) => {
  lookup.mockReturnValue({ data: null, isPending: false, error: { status: 503 } });
  openPage(path);
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  expect(screen.getByText(path)).toBeTruthy();
});

it.each(memberRoutes)('retains %s as the return destination for a signed-out visitor', (path) => {
  lookup.mockReturnValue({ data: null, isPending: false, error: null });
  openPage(path);
  expect(screen.getByText('Sign in')).toBeTruthy();
  expect(screen.getByText('/login?redirect=' + encodeURIComponent(path))).toBeTruthy();
});
