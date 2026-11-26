import { beforeEach, describe, expect, it, vi } from 'vitest';

const fakes = vi.hoisted(() => ({ connection: vi.fn(), blocked: vi.fn() }));
vi.mock('./block-check.js', () => ({ isBlocked: fakes.blocked }));
vi.mock('@/server/db/client.js', () => ({
  db: { select: () => ({ from: () => ({ where: () => ({ limit: fakes.connection }) }) }) },
}));
import { profileAudience } from './profile-audience';

const profile = { id: 'owner', profileVisibility: 'public' };

beforeEach(() => {
  fakes.connection.mockResolvedValue([]);
  fakes.blocked.mockResolvedValue(false);
});

describe('profile audience', () => {
  it('shows private fields only in the owner view', async () => {
    expect((await profileAudience(profile, 'owner', undefined))?.tiers).toEqual(['public', 'coven', 'private']);
    expect((await profileAudience(profile, null, undefined))?.tiers).toEqual(['public']);
    expect((await profileAudience(profile, 'owner', 'public'))?.allows('private')).toBe(false);
    expect((await profileAudience(profile, 'owner', 'coven'))?.allows('coven')).toBe(true);
  });

  it('requires an accepted connection for a Coven profile, including direct links', async () => {
    const restricted = { ...profile, profileVisibility: 'coven' };
    expect((await profileAudience(restricted, null, undefined))?.allowed).toBe(false);
    expect((await profileAudience(restricted, 'outsider', 'coven'))?.allowed).toBe(false);
    fakes.connection.mockResolvedValueOnce([{ id: 1, status: 'accepted' }]);
    expect((await profileAudience(restricted, 'friend', undefined))?.tiers).toEqual(['public', 'coven']);
    expect((await profileAudience(restricted, 'owner', 'public'))?.allowed).toBe(false);
  });

  it('refuses blocked viewers', async () => {
    fakes.blocked.mockResolvedValueOnce(true);
    expect(await profileAudience(profile, 'blocked', undefined)).toBeNull();
  });
});
