import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import MobileBottomNav from './MobileBottomNav';
import { COMMUNITY_FEED } from '@/lib/community-navigation';

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock('@/lib/auth/auth-client', () => ({ useSession: lookup }));
vi.mock('@/hooks/useNotificationCounts', () => ({ useNotificationCounts: () => ({ counts: { total: 0 } }) }));

afterEach(cleanup);

function Location() {
  const { pathname, search } = useLocation();
  return <output>{pathname + search}</output>;
}

it.each([
  { member: true, destination: COMMUNITY_FEED },
  { member: false, destination: COMMUNITY_FEED },
])('opens the appropriate Sparks timeline from Coven for member=$member', ({ member, destination }) => {
  lookup.mockReturnValue({ session: member ? { user: { id: 'reader' } } : null, isPending: false });
  render(<MemoryRouter initialEntries={['/']}><MobileBottomNav /><Location /></MemoryRouter>);
  const nav = within(screen.getByRole('navigation', { name: 'Mobile bottom navigation' }));
  const coven = nav.getByRole('link', { name: 'Coven' });
  const home = nav.getByRole('link', { name: 'Home' });
  fireEvent.click(coven);
  expect(screen.getByText(destination)).toBeInTheDocument();
  expect(coven).toHaveAttribute('aria-current', 'page');
  fireEvent.click(home);
  expect(screen.getByText('/')).toBeInTheDocument();
  expect(home).toHaveAttribute('aria-current', 'page');
});
