import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, expect, it, vi } from 'vitest';
import MyCoven from './MyCoven';

const member = {
  id: 1, status: 'accepted', requesterId: 'self', receiverId: 'cedar',
  otherName: 'Cedar', otherUsername: 'cedar', otherImage: null, createdAt: '2026-01-01',
};

function openCoven(...responses: Response[]) {
  vi.stubGlobal('fetch', async (url: string) => {
    if (url === '/api/coven') {
      const response = responses.shift();
      if (!response) throw new Error('Unexpected member list request');
      return response;
    }
    return Response.json(url === '/api/coven/suggestions' ? { suggestions: [] } : { online: false });
  });
  render(<MemoryRouter><MyCoven currentUserId="self" /></MemoryRouter>);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it.each([503, 200])('offers Retry for an unavailable or incomplete list (HTTP %i)', async (status) => {
  openCoven(Response.json({}, { status }), Response.json({ connections: [] }));
  const retry = await screen.findByRole('button', { name: 'Retry' });
  expect(screen.queryByText(/your coven is empty/i)).toBeNull();
  fireEvent.click(retry);
  expect(await screen.findByText(/your coven is empty/i)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
});

it.each([401, 403])('keeps the last list during an outage and hides it after HTTP %i', async (status) => {
  openCoven(
    Response.json({ connections: [member] }),
    Response.json({}, { status: 503 }),
    Response.json({}, { status }),
  );
  await screen.findByRole('link', { name: 'Cedar' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh Coven members' }));
  await screen.findByText(/showing the last loaded list/i);
  expect(screen.getByRole('link', { name: 'Cedar' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await screen.findByText('Couldn’t load your Coven members.');
  expect(screen.queryByRole('link', { name: 'Cedar' })).toBeNull();
});

it('cancels only pending invitations and reloads a connection accepted in another tab', async () => {
  const pending = { ...member, status: 'pending' };
  let listed = pending;
  const fetch = vi.fn(async (url: string, options?: RequestInit) => {
    if (options?.method === 'DELETE') {
      listed = member;
      return Response.json({ error: 'Request is no longer pending' }, { status: 409 });
    }
    if (url === '/api/coven') return Response.json({ connections: [listed] });
    return Response.json(url === '/api/coven/suggestions' ? { suggestions: [] } : { online: false });
  });
  vi.stubGlobal('fetch', fetch);
  render(<MemoryRouter><MyCoven currentUserId="self" /></MemoryRouter>);
  fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
  expect(fetch).toHaveBeenCalledWith('/api/coven/1?pending=1', {
    credentials: 'include', method: 'DELETE',
  });
  expect(await screen.findByText('This invitation is no longer pending.')).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'All Members (1)' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
});
