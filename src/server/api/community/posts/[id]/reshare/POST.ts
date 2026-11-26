import type { Request, Response } from 'express';
import { and, count, eq } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPosts } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { visiblePostForMember } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const viewer = (await getAuthSession(req))?.user?.id;
  if (!viewer) return res.sendStatus(401);
  const id = Number(req.params.id);
  const desired = req.body?.reshared;
  if (!Number.isSafeInteger(id) || id < 1 || typeof desired !== 'boolean') return res.sendStatus(400);
  const result = await db.transaction(async tx => {
    const [source] = await tx.select({ categoryId: communityPosts.categoryId }).from(communityPosts)
      .where(and(visiblePostForMember(id, viewer), eq(communityPosts.type, 'spark'),
        eq(communityPosts.audience, 'public'))).limit(1).for('update');
    if (!source && desired) return null;
    const owned = and(eq(communityPosts.reshareOf, id), eq(communityPosts.userId, viewer));
    const [existing] = await tx.select({ id: communityPosts.id }).from(communityPosts).where(owned).limit(1);
    if (source && desired && !existing) await tx.insert(communityPosts).values({
      userId: viewer, categoryId: source.categoryId, type: 'spark', title: '', body: '', audience: 'public',
      originalSparkId: id, reshareOf: id,
    });
    if (!desired && existing) await tx.delete(communityPosts).where(owned);
    if (!source) return { reshared: false, reshareCount: 0 };
    const [totals] = await tx.select({ n: count() }).from(communityPosts)
      .where(and(eq(communityPosts.reshareOf, id), eq(communityPosts.isHidden, false)));
    return { reshared: desired, reshareCount: Number(totals.n) };
  });
  if (!result) return res.sendStatus(404);
  res.json(result);
}
