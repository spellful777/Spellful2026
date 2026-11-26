import { notifyCommunityMentions } from '@/server/lib/community-mention-notifications.js';
import { visiblePostForMember } from '@/server/lib/community-post-access.js';
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityReplies, communityPosts, communityNotifications } from '@/server/db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

import { isBlocked } from '@/server/lib/block-check.js';

const MAX_DEPTH = 4;

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to reply' });

  const postId = Number(req.params.id);
  if (!Number.isSafeInteger(postId) || postId < 1) return res.status(400).json({ error: 'Invalid id' });

  const [post] = await db.select({ userId: communityPosts.userId, isLocked: communityPosts.isLocked }).from(communityPosts).where(visiblePostForMember(postId, session.user.id)).limit(1);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.isLocked) return res.status(403).json({ error: 'Post is locked' });

  const { body, parentId } = req.body as { body?: string; parentId?: number };
  if (typeof body !== 'string' || !body.trim()) return res.status(400).json({ error: 'body is required' });

  let depth = 0;
  if (parentId != null) {
    if (!Number.isSafeInteger(parentId) || parentId < 1) {
      return res.status(400).json({ error: 'Invalid parent reply' });
    }
    const [parent] = await db.select({ depth: communityReplies.depth, userId: communityReplies.userId })
      .from(communityReplies)
      .where(and(eq(communityReplies.id, parentId), eq(communityReplies.postId, postId), eq(communityReplies.isHidden, false)))
      .limit(1);
    if (!parent || await isBlocked(session.user.id, parent.userId)) {
      return res.status(404).json({ error: 'Parent reply not found' });
    }
    depth = Math.min((parent.depth ?? 0) + 1, MAX_DEPTH);
  }

  const replyId = await db.transaction(async (tx) => {
    const [result] = await tx.insert(communityReplies).values({
      postId,
      userId: session.user.id,
      parentId: parentId ?? null,
      body: body.trim(),
      depth,
    });
    await tx.update(communityPosts).set({ replyCount: sql`COALESCE(reply_count, 0) + 1` })
      .where(eq(communityPosts.id, postId));
    return result.insertId;
  });

  // Notify post author (if not self)
  if (post.userId !== session.user.id) {
    await db.insert(communityNotifications).values({
      userId: post.userId,
      type: 'reply',
      actorId: session.user.id,
      postId,
      replyId,
      message: 'Someone replied to your post.',
    }).catch(() => {});
  }

  await notifyCommunityMentions({ html: body, actorId: session.user.id, postId, replyId, alreadyNotified: post.userId }).catch(() => {
    console.error('community.mention-notifications.failed');
  });

  res.status(201).json({ id: replyId });
}
