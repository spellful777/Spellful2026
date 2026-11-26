import { SPARK_COMMENT_LIMIT, commentGifUrl } from '@/lib/spark-comments';
import { countSparkCharacters, sparkBodyHtml } from '@/lib/sparks';
import { renderSharedReading, sharedReadingSchema } from '@/lib/shared-reading';
import { notifyCommunityFollowUp } from '@/server/lib/community-follow-up.js';
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

  const [post] = await db.select({ userId: communityPosts.userId, type: communityPosts.type, isLocked: communityPosts.isLocked }).from(communityPosts).where(visiblePostForMember(postId, session.user.id)).limit(1);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.isLocked) return res.status(403).json({ error: 'Post is locked' });

  const { suppressLinkPreview, body = '', parentId, followUp = false, sharedReading, gifUrl: rawGif } = req.body as {
    suppressLinkPreview?: boolean; body?: string; parentId?: number; followUp?: boolean; sharedReading?: unknown; gifUrl?: unknown;
  };
  const spark = post.type === 'spark';
  const gifUrl = spark ? commentGifUrl(rawGif) : null;
  if (rawGif != null && !gifUrl) return res.status(400).json({ error: 'Invalid GIF link' });
  if (typeof body !== 'string' || (!body.trim() && !gifUrl && sharedReading === undefined)) {
    return res.status(400).json({ error: 'body is required' });
  }
  if (spark && countSparkCharacters(body) > SPARK_COMMENT_LIMIT) {
    return res.status(400).json({ error: 'Comments can be up to 280 characters.' });
  }
  const replyBody = spark ? sparkBodyHtml(body.trim()) : body.trim();

  if (typeof followUp !== 'boolean' || (followUp && parentId != null)) {
    return res.status(400).json({ error: 'A follow-up must be a top-level reply' });
  }
  if (followUp && post.userId !== session.user.id) {
    return res.status(403).json({ error: 'Only the author can add a follow-up' });
  }

  let readingHtml = '';
  if (sharedReading !== undefined) {
    if (!followUp) return res.status(400).json({ error: 'Readings can only be attached to author follow-ups' });
    const parsed = sharedReadingSchema.safeParse(sharedReading);
    const rendered = parsed.success ? renderSharedReading(parsed.data) : null;
    if (!rendered) return res.status(400).json({ error: 'Invalid shared reading' });
    readingHtml = rendered;
  }

  let depth = 0;
  let parentAuthor: string | undefined;
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
    parentAuthor = parent.userId;
    depth = Math.min((parent.depth ?? 0) + 1, MAX_DEPTH);
  }

  const replyId = await db.transaction(async (tx) => {
    const [result] = await tx.insert(communityReplies).values({
      postId,
      userId: session.user.id,
      parentId: parentId ?? null,
      body: followUp ? `<p><strong>Author follow-up</strong></p>${replyBody}${readingHtml}` : replyBody,
      gifUrl,
      suppressLinkPreview: suppressLinkPreview === true,
      depth,
    });
    await tx.update(communityPosts).set({ replyCount: sql`COALESCE(reply_count, 0) + 1` })
      .where(eq(communityPosts.id, postId));
    return result.insertId;
  });

  const recipient = parentAuthor ?? post.userId;
  if (recipient !== session.user.id) {
    await db.insert(communityNotifications).values({
      userId: recipient,
      type: 'reply',
      actorId: session.user.id,
      postId,
      replyId,
      message: 'Someone replied to your post.',
    }).catch(() => {});
  }

  if (followUp) {
    await notifyCommunityFollowUp(postId, replyId, session.user.id).catch(() => {
      console.error('community.follow-up-notifications.failed');
    });
    return res.status(201).json({ id: replyId });
  }

  await notifyCommunityMentions({ html: replyBody, actorId: session.user.id, postId, replyId, alreadyNotified: recipient }).catch(() => {
    console.error('community.mention-notifications.failed');
  });

  res.status(201).json({ id: replyId });
}
