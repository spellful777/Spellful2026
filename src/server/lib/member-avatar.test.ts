// @vitest-environment node
import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATARS, STARTER_AVATAR, profileAvatar } from '@/lib/default-avatars';

const mocks = vi.hoisted(() => ({ session: vi.fn(), entitlement: vi.fn(), set: vi.fn() }));
vi.mock('./auth-session.js', () => ({ getAuthSession: mocks.session }));
vi.mock('./plus-entitlement.js', () => ({ getEntitlement: mocks.entitlement }));
vi.mock('@/server/db/client.js', () => ({ db: { update: () => ({ set: mocks.set }) } }));
import selectHat from '../api/account/avatar/default/POST';
import upload from '../api/account/avatar/POST';
import updateProfile from '../api/profile/PATCH';

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ user: { id: 'fixture' } });
  mocks.entitlement.mockResolvedValue({ isPlus: false });
  mocks.set.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
});

describe('member avatar selection', () => {
  it('ships all nine different original PNGs at versioned public URLs', () => {
    expect(DEFAULT_AVATARS.map(hat => hat.label)).toEqual([
      'White', 'Orange', 'Red', 'Blue', 'Green', 'Purple', 'Rainbow Pride', 'Lesbian Pride', 'Trans Pride',
    ]);
    for (const hat of DEFAULT_AVATARS) {
      const [path, version] = hat.src.split('?v=');
      const image = readFileSync('public' + path);
      expect(image.subarray(1, 4).toString()).toBe('PNG');
      expect(createHash('sha256').update(image).digest('hex').slice(0, 10)).toBe(version);
    }
  });

  it.each(DEFAULT_AVATARS)('saves $label consistently from both editors', async hat => {
    for (const url of [hat.legacyUrl, hat.src]) {
      const res = response();
      await selectHat({ body: { url } } as Request, res);
      expect(res.json).toHaveBeenCalledWith({ url: hat.src });
    }
    await updateProfile({ body: { avatarPreset: hat.key } } as Request, response());
    expect(mocks.set.mock.calls.map(([fields]) => fields)).toEqual(Array(3).fill({ image: hat.src, avatarPreset: hat.key }));
    expect(profileAvatar(null, hat.key)).toBe(hat.src);
    expect(profileAvatar(hat.legacyUrl)).toBe(hat.src);
  });

  it('keeps custom photos when editing other fields', async () => {
    await updateProfile({ body: { bio: 'Moon watcher' } } as Request, response());
    expect(mocks.set).toHaveBeenCalledWith({ bio: 'Moon watcher' });
    expect(profileAvatar('/uploads/photo.png', STARTER_AVATAR.key)).toBe('/uploads/photo.png');
    expect(profileAvatar(null)).toBe(STARTER_AVATAR.src);
  });

  it('rejects other preset choices and enforces Plus for uploads', async () => {
    const preset = response(), studio = response(), free = response(), plus = response();
    await selectHat({ body: { url: '/uploads/photo.png' } } as Request, preset);
    await updateProfile({ body: { avatarPreset: 'outside-catalogue' } } as Request, studio);
    await upload({ headers: {} } as Request, free);
    expect(preset.status).toHaveBeenCalledWith(400);
    expect(studio.status).toHaveBeenCalledWith(400);
    expect(free.status).toHaveBeenCalledWith(403);
    mocks.entitlement.mockResolvedValue({ isPlus: true });
    await upload({ headers: {} } as Request, plus);
    expect(plus.status).toHaveBeenCalledWith(400);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
