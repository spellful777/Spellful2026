import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), where: vi.fn(), limit: vi.fn(), block: vi.fn(), insert: vi.fn(),
}));
vi.mock('./auth-session.js', () => ({ getAuthSession: mocks.session }));
vi.mock('./block-check.js', () => ({ getBlockedUserIds: mocks.block }));
vi.mock('@/server/db/client.js', () => ({
  db: {
    select: () => ({ from: () => ({
      where: mocks.where,
      innerJoin: () => ({ where: mocks.where }),
    }) }),
    insert: () => ({ values: mocks.insert }),
  },
}));
import chartImage from '../api/community/posts/[id]/chart/GET';
import { sparkShareMeta } from './spark-share-meta';
import { notifyConversationReply } from './community-conversation-notification';

const chart = {
  type: 'natal', ascendant: 5, houses: Array.from({ length: 12 }, (_, i) => i * 30),
  planets: Array.from({ length: 10 }, (_, i) => i * 30),
};
const fakeResponse = () => {
  const fake = { setHeader: vi.fn(), set: vi.fn(), sendStatus: vi.fn(), json: vi.fn(), send: vi.fn(), type: vi.fn() };
  fake.type.mockReturnValue(fake);
  return fake as unknown as Response;
};
const request = { params: { id: '12' } } as Request<{ id: string }>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.where.mockReturnValue({ limit: mocks.limit });
  mocks.block.mockResolvedValue(new Set());
});
const query = (where: SQL) => new MySqlDialect().sqlToQuery(where);

describe('Spark attachment route access', () => {
  it('downloads the wheel for a public Spark without exporting the original chart or metadata', async () => {
    mocks.limit.mockResolvedValue([{ reading: chart }]);
    const res = fakeResponse();
    await chartImage(request, res);
    expect(res.type).toHaveBeenCalledWith('image/svg+xml');
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('<svg'));
    expect(vi.mocked(res.send).mock.calls[0][0]).not.toMatch(/metadata|birth|latitude|longitude/i);
    const [onlyPublic] = mocks.where.mock.calls[0];
    expect(query(onlyPublic).sql).toContain("= 'public'");
    expect(query(onlyPublic).sql).not.toContain('coven_connections');
  });

  it('checks actual viewer access and refuses unavailable content or payloads with raw private fields', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'coven-viewer' } });
    mocks.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ reading: { ...chart, birthTime: '22:22' } }]);
    for (let i = 0; i < 2; i++) {
      const res = fakeResponse();
      await chartImage(request, res);
      expect(res.sendStatus).toHaveBeenCalledWith(404);
      expect(res.send).not.toHaveBeenCalled();
    }
    const condition = query(mocks.where.mock.calls[0][0]);
    expect(condition.sql).toContain('coven_connections');
    expect(condition.params).toContain('coven-viewer');
  });

  it('returns only attachment type to the social preview and does not share restricted previews', async () => {
    mocks.limit.mockResolvedValueOnce([{ reading: chart }]).mockResolvedValueOnce([]);
    const open = fakeResponse(), restricted = fakeResponse();
    await sparkShareMeta(request, open);
    await sparkShareMeta(request, restricted);
    expect(open.json).toHaveBeenCalledWith({ type: 'natal' });
    expect(restricted.sendStatus).toHaveBeenCalledWith(404);
    expect(query(mocks.where.mock.calls[0][0]).params).toContain('public');
  });
});

describe('conversation reply recipients', () => {
  it('writes just one direct notification when the parent author also owns the Spark', async () => {
    mocks.where.mockResolvedValue([{ id: 'owner' }]);
    const recipients = await notifyConversationReply({ postId: 12, replyId: 24, actor: 'reader', owner: 'owner', parent: 'owner' });
    expect(recipients).toEqual(['owner']);
    expect(mocks.insert).toHaveBeenCalledWith([expect.objectContaining({ type: 'direct_reply', userId: 'owner', replyId: 24 })]);
  });
  it('queries current notification settings and mute state before any event is written', async () => {
    mocks.where.mockResolvedValue([]);
    await notifyConversationReply({ postId: 12, replyId: 24, actor: 'reader', owner: 'owner' });
    expect(query(mocks.where.mock.calls[0][0]).sql).toMatch(/communityReplies/);
    expect(query(mocks.where.mock.calls[0][0]).sql).toMatch(/community_mutes/);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
