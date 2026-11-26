import { visiblePostForMember } from '@/server/lib/community-post-access.js';
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityBookmarks, communityPosts } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid id' });

  const desired = req.body?.bookmarked;
  if (desired !== undefined && typeof desired !== 'boolean') {
    return res.status(400).json({ error: 'Invalid favorite state' });
  }

  const result = await db.transaction(async (tx) => {
    const [post] = await tx.select({ id: communityPosts.id }).from(communityPosts)
      .where(visiblePostForMember(postId, session.user.id)).limit(1).for('update');
    if (!post) return null;

    const [existing] = await tx.select({ id: communityBookmarks.id }).from(communityBookmarks)
      .where(and(eq(communityBookmarks.userId, session.user.id), eq(communityBookmarks.postId, postId))).limit(1);
    const bookmarked = desired ?? !existing;
    if (bookmarked && !existing) {
      await tx.insert(communityBookmarks).values({ userId: session.user.id, postId });
    } else if (!bookmarked && existing) {
      await tx.delete(communityBookmarks).where(eq(communityBookmarks.id, existing.id));
    }
    return { bookmarked };
  });
  if (!result) return res.status(404).json({ error: 'Post not found' });
  return res.json(result);
}
