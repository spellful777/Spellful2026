import { visiblePostForMember } from '@/server/lib/community-post-access.js';
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityLikes, communityPosts } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const memberId = (await getAuthSession(req))?.user?.id;
  if (!memberId) return res.status(401).json({ error: 'Unauthorized' });

  const postId = parseInt(req.params.id, 10);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid id' });
  const desired = req.body?.liked;
  if (desired !== undefined && typeof desired !== 'boolean') {
    return res.status(400).json({ error: 'Invalid like state' });
  }

  const result = await db.transaction(async (tx) => {
    // Lock the post so the reaction and its count change together.
    const [post] = await tx.select({ likeCount: communityPosts.likeCount }).from(communityPosts)
      .where(visiblePostForMember(postId, memberId)).limit(1).for('update');
    if (!post) return null;

    const [existing] = await tx.select({ id: communityLikes.id }).from(communityLikes)
      .where(and(eq(communityLikes.userId, memberId), eq(communityLikes.targetType, 'post'), eq(communityLikes.targetId, postId))).limit(1);
    const liked = desired ?? !existing;
    let likeCount = post.likeCount ?? 0;

    if (liked && !existing) {
      await tx.insert(communityLikes).values({ userId: memberId, targetType: 'post', targetId: postId });
      likeCount += 1;
    } else if (!liked && existing) {
      await tx.delete(communityLikes).where(eq(communityLikes.id, existing.id));
      likeCount = Math.max(0, likeCount - 1);
    }

    if (likeCount !== post.likeCount) {
      await tx.update(communityPosts).set({ likeCount }).where(eq(communityPosts.id, postId));
    }
    return { liked, likeCount };
  });

  if (!result) return res.status(404).json({ error: 'Post not found' });
  return res.json(result);
}
