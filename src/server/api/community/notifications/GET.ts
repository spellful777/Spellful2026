import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityBlocks, communityNotifications, communityPosts, communityReplies, user } from '@/server/db/schema.js';
import { and, eq, desc, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

import { postAudienceAllows } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = 30;
  const offset = (page - 1) * limit;

  const viewer = session.user.id;
  const visible = and(eq(communityNotifications.userId, viewer), sql`(
    ${communityNotifications.type} <> 'mention' or (
      exists (select 1 from ${communityPosts}
        where ${communityPosts.id} = ${communityNotifications.postId}
          and ${communityPosts.isHidden} = false and ${postAudienceAllows(viewer)})
      and (${communityNotifications.replyId} is null or exists (select 1 from ${communityReplies}
        where ${communityReplies.id} = ${communityNotifications.replyId}
          and ${communityReplies.postId} = ${communityNotifications.postId}
          and ${communityReplies.isHidden} = false))
      and not exists (select 1 from ${communityBlocks} where
        (${communityBlocks.blockerId} = ${viewer} and ${communityBlocks.blockedId} = ${communityNotifications.actorId}) or
        (${communityBlocks.blockedId} = ${viewer} and ${communityBlocks.blockerId} = ${communityNotifications.actorId}))
    )
  )`);

  const [notifications, [{ unread }]] = await Promise.all([
    db.select({
      id: communityNotifications.id,
      type: communityNotifications.type,
      postId: communityNotifications.postId,
      replyId: communityNotifications.replyId,
      message: communityNotifications.message,
      isRead: communityNotifications.isRead,
      createdAt: communityNotifications.createdAt,
      actorName: user.name,
      actorImage: user.image,
      actorUsername: user.username,
    })
      .from(communityNotifications)
      .leftJoin(user, eq(communityNotifications.actorId, user.id))
      .where(visible)
      .orderBy(desc(communityNotifications.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ unread: sql<number>`SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END)` })
      .from(communityNotifications)
      .where(visible),
  ]);

  res.json({ notifications, unread: unread ?? 0 });
}
