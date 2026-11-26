import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityMutes, communityPosts } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { visiblePostForMember } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request, res: Response) {
  const viewer = (await getAuthSession(req))?.user?.id;
  if (!viewer) return res.sendStatus(401);
  const { postId, muted: desired } = req.body as { postId: number; muted?: boolean };
  if (!Number.isSafeInteger(postId) || postId < 1 || (desired !== undefined && typeof desired !== 'boolean')) return res.sendStatus(400);
  const result = await db.transaction(async tx => {
    const [post] = await tx.select({ id: communityPosts.id }).from(communityPosts)
      .where(visiblePostForMember(postId, viewer)).limit(1).for('update');
    if (!post) return null;
    const condition = and(eq(communityMutes.userId, viewer), eq(communityMutes.postId, postId));
    const [existing] = await tx.select({ id: communityMutes.id }).from(communityMutes).where(condition).limit(1);
    const muted = desired ?? !existing;
    if (muted && !existing) await tx.insert(communityMutes).values({ userId: viewer, postId });
    if (!muted && existing) await tx.delete(communityMutes).where(condition);
    return { muted };
  });
  if (!result) return res.sendStatus(404);
  return res.json(result);
}
