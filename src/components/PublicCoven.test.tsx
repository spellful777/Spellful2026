import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import PublicCoven from './PublicCoven';

vi.mock('@/lib/auth/auth-client', () => ({ useSession: () => ({ user: null }) }));
afterEach(() => vi.unstubAllGlobals());

it('offers a signed-out visitor real topic activity and a return path to their Coven', async () => {
  const fetch = vi.fn(async (path: string) => Response.json(
    path.endsWith('/members') ? { members: [] } : { posts: [], pages: 1 },
  ));
  vi.stubGlobal('fetch', fetch);
  render(<HelmetProvider><MemoryRouter><PublicCoven /></MemoryRouter></HelmetProvider>);

  expect(await screen.findByText('No Sparks yet.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in to your Coven' })).toHaveAttribute('href', '/login?redirect=%2Fcommunity');
  expect(screen.getByRole('link', { name: 'Moon Magic' })).toHaveAttribute('href', '/explore/topics/moon-magic');
  expect(fetch.mock.calls.map(([path]) => path)).toEqual([
    '/api/community/posts?topic=tarot&page=1',
    '/api/community/topics/tarot/members',
  ]);
});
