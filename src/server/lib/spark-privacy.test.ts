import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { MySqlDialect } from 'drizzle-orm/mysql-core';
import type { SQL } from 'drizzle-orm';

const mocks = vi.hoisted(() => ({
  session: vi.fn(), where: vi.fn(), rows: vi.fn(), dbRead: vi.fn(),
}));
vi.mock('./auth-session.js', () => ({ getAuthSession: mocks.session }));
vi.mock('./original-sparks.js', () => ({ loadOriginalSparks: vi.fn() }));
vi.mock('./spark-reshares.js', () => ({ sparkReshares: vi.fn() }));
vi.mock('@/server/db/client.js', () => ({
  db: {
    select: () => ({ from: () => ({
      innerJoin: () => ({ where: mocks.where }),
    }) }),
    $with: () => ({ as: () => ({ rank: { name: 'rank' } }) }),
    with: () => ({ select: () => ({ from: () => ({ where: () => ({ orderBy: mocks.rows }) }) }) }),
    selectDistinct: () => mocks.dbRead(),
  },
}));
import { sparkCollections } from './spark-collections';
import { communityLikePreviews } from './community-like-previews';
import { commentLinkPreview } from './comment-link-preview';

function response() {
  return { sendStatus: vi.fn(), json: vi.fn(), setHeader: vi.fn() } as unknown as Response;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.where.mockResolvedValue([{ total: 2 }]);
  mocks.rows.mockResolvedValue([{ id: 3, name: 'Willow' }]);
});

describe('private Spark collections and Like previews', () => {
  it('rejects unsigned collection and link-preview requests before reading data', async () => {
    const res = response();
    await sparkCollections({ query: { userId: 'someone-else' } } as unknown as Request, res);
    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(mocks.where).not.toHaveBeenCalled();
    await commentLinkPreview({} as Request, res);
    expect(res.sendStatus).toHaveBeenCalledWith(401);
  });

  it('takes the collection owner from the session and filters its counts for access', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'viewer' } });
    const res = response();
    await sparkCollections({ query: { userId: 'someone-else' } } as unknown as Request, res);
    const queries = mocks.where.mock.calls.map(([where]) => new MySqlDialect().sqlToQuery(where as SQL));
    expect(queries[0].sql).toMatch(/audience/);
    expect(queries[0].params).toContain('viewer');
    expect(queries[0].params).not.toContain('someone-else');
    expect(res.json).toHaveBeenCalledWith({ counts: { favorite: 2, saved: 2 } });
  });

  it('re-queries the current opt-in and blocks Spark favoriters even on the post preview path', async () => {
    expect((await communityLikePreviews('post', [3], 'viewer')).get(3)).toEqual(['Willow']);
    const [condition] = mocks.where.mock.calls[0];
    const query = new MySqlDialect().sqlToQuery(condition as SQL);
    expect(query.sql).toMatch(/share_likes_with_coven/);
    expect(query.sql).toMatch(/coven_connections/);
    expect(query.sql).toMatch(/community_blocks/);
    expect(query.sql).toMatch(/<> 'spark'/);
    mocks.rows.mockResolvedValueOnce([]);
    expect((await communityLikePreviews('post', [3], 'viewer')).has(3)).toBe(false);
  });

  it('returns no metadata for local addresses or non-HTTPS URLs', async () => {
    mocks.session.mockResolvedValue({ user: { id: 'viewer' } });
    for (const url of ['https://127.0.0.1/', 'https://localhost/', 'http://example.org/']) {
      const res = response();
      await commentLinkPreview({ query: { url } } as unknown as Request, res);
      expect(res.json).toHaveBeenCalledWith(null);
    }
  });
});
