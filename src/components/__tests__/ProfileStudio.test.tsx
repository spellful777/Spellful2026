import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import EditProfilePage from '@/pages/account/edit-profile';
import ProfileStudioPage from '@/pages/account/profile';

const member = { id: 'studio-owner', name: 'Sable', username: 'sable' };
vi.mock('@/lib/auth/auth-client', () => ({ useSession: () => ({ session: { user: member }, isPending: false, refetch: vi.fn() }) }));
vi.mock('@/lib/use-plus-entitlement', () => ({ useEntitlement: () => ({ data: { isPlus: false } }) }));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function mount(identity = false, status = 200) {
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === '/api/profile/sable') return Response.json({ profile: {
      ...member, bio: 'A private note', bioVisibility: 'private', profileVisibility: 'public',
      coverPreset: 'cosmos', messagePermission: 'coven', invitePermission: 'nobody',
    } }, { status });
    return Response.json(init?.method === 'PATCH' ? { ok: true } : {});
  });
  vi.stubGlobal('fetch', fetcher);
  render(<HelmetProvider><MemoryRouter>{identity ? <EditProfilePage /> : <ProfileStudioPage />}</MemoryRouter></HelmetProvider>);
  return fetcher;
}

it('opens Look on the Studio route, marks the saved cover and filters a private bio in public preview', async () => {
  mount();
  expect(await screen.findByRole('button', { name: 'Cosmos' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Public' }));
  expect(screen.queryByText('A private note')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Live Preview/ })).toHaveAttribute('href', '/u/sable?preview=public');
});

it('opens Edit profile on identity and submits just the edited value', async () => {
  const fetcher = mount(true);
  const field = await screen.findByPlaceholderText('Tell your story…');
  fireEvent.change(field, { target: { value: 'Updated bio' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
    method: 'PATCH', body: JSON.stringify({ bio: 'Updated bio' }),
  })));
  expect(await screen.findByRole('button', { name: 'Saved' })).toBeDisabled();
});

it('previews an unsaved free hat and saves its canonical preset without changing other fields', async () => {
  const fetcher = mount();
  fireEvent.click(await screen.findByRole('button', { name: 'Profile picture' }));
  const hat = screen.getByRole('button', { name: 'Green' });
  fireEvent.click(hat);
  expect(hat).toHaveAttribute('aria-pressed', 'true');
  const previews = screen.getAllByRole('img', { name: member.name });
  expect(previews.every(image => image.getAttribute('src')?.includes('avatars-default-hat-green-'))).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
    method: 'PATCH', body: JSON.stringify({ avatarPreset: 'default-hat-green' }),
  })));
});

it('offers Retry after a failed owner lookup and keeps the editor closed', async () => {
  mount(true, 503);
  expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument();
});
