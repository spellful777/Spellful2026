import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityLikes, communityPosts, communityReplies, communityReplyFavorites } from '@/server/db/schema.js';
import { and, eq, notInArray } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { getBlockedUserIds } from '@/server/lib/block-check.js';
import { postAudienceAllows } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const viewer = session.user.id;
  const replyId = Number(req.params.id);
  if (!Number.isSafeInteger(replyId) || replyId < 1) return res.status(400).json({ error: 'Invalid id' });

  const favorite = req.body?.favorited;
  const desiredLike = req.body?.liked;
  if ((favorite !== undefined && typeof favorite !== 'boolean') ||
      (desiredLike !== undefined && typeof desiredLike !== 'boolean')) {
    return res.status(400).json({ error: 'Invalid action state' });
  }

  const blocked = [...await getBlockedUserIds(viewer)];
  const result = await db.transaction(async (tx) => {
    const [reply] = await tx.select({ id: communityReplies.id, likeCount: communityReplies.likeCount, type: communityPosts.type })
      .from(communityReplies)
      .innerJoin(communityPosts, eq(communityReplies.postId, communityPosts.id))
      .where(and(eq(communityReplies.id, replyId), eq(communityReplies.isHidden, false),
        eq(communityPosts.isHidden, false), postAudienceAllows(viewer),
        blocked.length ? notInArray(communityReplies.userId, blocked) : undefined))
      .limit(1).for('update');
    if (!reply) return null;

    if (favorite !== undefined) {
      if (reply.type !== 'spark') return null;
      if (favorite) {
        await tx.insert(communityReplyFavorites).values({ userId: viewer, replyId })
          .onDuplicateKeyUpdate({ set: { replyId } });
      } else {
        await tx.delete(communityReplyFavorites).where(and(eq(communityReplyFavorites.userId, viewer),
          eq(communityReplyFavorites.replyId, replyId)));
      }
      return { favorited: favorite };
    }

    const forViewer = and(eq(communityLikes.userId, viewer), eq(communityLikes.targetType, 'reply'),
      eq(communityLikes.targetId, replyId));
    const [existing] = await tx.select({ id: communityLikes.id }).from(communityLikes).where(forViewer).limit(1);
    const liked = desiredLike ?? !existing;
    let likeCount = reply.likeCount ?? 0;
    if (liked && !existing) {
      await tx.insert(communityLikes).values({ userId: viewer, targetType: 'reply', targetId: replyId });
      likeCount++;
    } else if (!liked && existing) {
      await tx.delete(communityLikes).where(forViewer);
      likeCount = Math.max(0, likeCount - 1);
    }
    if (liked !== Boolean(existing)) {
      await tx.update(communityReplies).set({ likeCount }).where(eq(communityReplies.id, replyId));
    }
    return { liked, likeCount };
  });
  if (!result) return res.status(404).json({ error: 'Reply not found' });
  return res.json(result);
}
