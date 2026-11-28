import { renderToStaticMarkup } from 'react-dom/server';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import CommunityPage from '../../pages/community/index';
import HomePage from '../../pages/index';

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('better-auth/react', () => ({ createAuthClient: () => ({ useSession: lookup }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function CurrentLocation() {
  const { pathname, search } = useLocation();
  return <output>{pathname}{search}</output>;
}

function openPage(path: string) {
  render(
    <HelmetProvider><MemoryRouter initialEntries={[path]}>
      <CurrentLocation />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/login" element={<p>Sign in</p>} />
      </Routes>
    </MemoryRouter></HelmetProvider>,
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

it.each([
  { member: false, startingPath: '/community', filter: 'discover', tab: 'Explore' },
  { member: false, startingPath: '/?feed=explore', filter: 'discover', tab: 'Explore' },
  { member: true, startingPath: '/community', filter: 'following', tab: 'Following' },
])('opens the Community feed from $startingPath for member=$member', async ({ member, startingPath }) => {
  lookup.mockReturnValue({ data: member ? { user: { id: 'reader', username: 'reader' } } : null, isPending: false });
  vi.stubGlobal('IntersectionObserver', class { observe() {} disconnect() {} unobserve() {} });
  const fetch = vi.fn(async (path: string) => Response.json(path.startsWith('/api/community/posts?') ? {
    posts: [{ id: 4, type: 'spark', title: 'A new moon reading', audience: 'public',
      authorName: 'Juniper', createdAt: '2026-11-25T13:00:00Z' }], pages: 1,
  } : { pendingRequests: 0 }));
  vi.stubGlobal('fetch', fetch);
  openPage(startingPath);

  const tabs = within(await screen.findByRole('navigation', { name: 'Community' }));
  expect(tabs.getByRole('link', { name: 'Feed' })).toHaveAttribute('aria-current', 'page');
  expect(tabs.getByRole('link', { name: 'Forums' })).toHaveAttribute('href', '/community?view=forums');
  expect(screen.getByRole('link', { name: 'Post' })).toHaveAttribute('href', '/community/new?kind=spark');
  expect(await screen.findByText('A new moon reading')).toBeVisible();
  expect(fetch).toHaveBeenCalledWith('/api/community/posts?filter=feed&limit=20', expect.anything());
  if (!member) {
    expect(screen.queryByRole('button', { name: 'Save Spark' })).toBeNull();
    expect(screen.getByRole('button', { name: 'More actions for Juniper’s Post' })).toBeEnabled();
    expect(fetch.mock.calls.some(([path]) => path.startsWith('/api/account/'))).toBe(false);
  }
});

function homeContent(data: unknown) {
  lookup.mockReturnValue({ data, isPending: false, error: null });
  const element = document.createElement('div');
  element.innerHTML = renderToStaticMarkup(
    <HelmetProvider><MemoryRouter><HomePage /></MemoryRouter></HelmetProvider>,
  );
  return within(element);
}

it('keeps the public reading directory and adds an independent link to Sparks', () => {
  const home = homeContent(null);
  expect(home.getByRole('link', { name: 'Explore Spellful' })).toHaveAttribute('href', '#explore');
  expect(home.getByRole('link', { name: 'Explore public Sparks' })).toHaveAttribute('href', '/?feed=explore');
  expect(home.getByRole('heading', { name: 'A community of seekers' })).toBeTruthy();
});

it('renders the member dashboard and the shared homepage sections alongside the Spark composer link', () => {
  const home = homeContent({ user: { id: 'test-member', name: 'Test Member' } });
  expect(home.getByText('Your Inner Universe')).toBeTruthy();
  expect(home.getByRole('heading', { name: 'Explore the Craft' })).toBeTruthy();
  expect(home.getByRole('link', { name: 'Post' })).toHaveAttribute('href', '/community/new?kind=spark');
  expect(home.getByRole('link', { name: 'Open Spark feed' })).toHaveAttribute('href', '/?feed=following');
});
