import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityBlocks, communityMutes, communityNotifications, communityPosts, communityReplies, user } from '@/server/db/schema.js';
import { and, count, countDistinct, eq, desc, inArray, max, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { postAudienceAllows } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request, res: Response) {
  const viewer = (await getAuthSession(req))?.user?.id;
  if (!viewer) return res.sendStatus(401);
  const page = Math.max(1, Math.min(10000, parseInt(req.query.page as string) || 1));
  const limit = 30;
  const event = communityNotifications;
  const visible = and(eq(event.userId, viewer),
    sql`${event.type} not in ('like', 'favorite', 'post_like', 'reply_like', 'spark_favorite')`,
    sql`not exists (select 1 from ${communityBlocks} where
      (${communityBlocks.blockerId} = ${viewer} and ${communityBlocks.blockedId} = ${event.actorId}) or
      (${communityBlocks.blockedId} = ${viewer} and ${communityBlocks.blockerId} = ${event.actorId}))`,
    sql`(${event.postId} is null or (${communityPosts.id} is not null
      and ${communityPosts.isHidden} = false and ${postAudienceAllows(viewer)}))`,
    sql`(${event.replyId} is null or exists (select 1 from ${communityReplies}
      where ${communityReplies.id} = ${event.replyId} and ${communityReplies.postId} = ${event.postId}
        and ${communityReplies.isHidden} = false))`);
  const inConversation = sql`
    ${event.type} = 'reply' and coalesce(${event.isRead}, false) = false
    and ${communityPosts.type} = 'spark' and ${communityPosts.userId} = ${viewer}
    and not exists (select 1 from ${communityReplies} child
      inner join ${communityReplies} parent on parent.id = child.parent_id
      where child.id = ${event.replyId} and parent.user_id = ${viewer})
  `;
  const groupKey = sql`case when ${inConversation} then concat('spark:', ${event.postId}) else concat('event:', ${event.id}) end`;
  const accessible = db.$with('visible_notifications').as(db.select({
    id: event.id,
    groupKey: sql<string>`${groupKey}`.as('group_key'),
    unread: sql<string | null>`case when coalesce(${event.isRead}, false) = false then ${groupKey} else null end`.as('unread_key'),
  }).from(event).leftJoin(communityPosts, eq(event.postId, communityPosts.id)).where(visible));
  const [groups, [total]] = await Promise.all([
    db.with(accessible).select({ id: max(accessible.id), size: count(), key: accessible.groupKey }).from(accessible)
      .groupBy(accessible.groupKey).orderBy(desc(max(accessible.id))).limit(limit).offset((page - 1) * limit),
    db.with(accessible).select({ unread: countDistinct(accessible.unread) }).from(accessible),
  ]);
  const ids = groups.flatMap(group => group.id == null ? [] : [group.id]);
  const rows = ids.length ? await db.select({
    id: event.id, type: event.type, postId: event.postId, replyId: event.replyId, message: event.message,
    isRead: event.isRead, createdAt: event.createdAt, actorName: user.name, actorImage: user.image, actorUsername: user.username,
    muted: sql<boolean>`exists (select 1 from ${communityMutes} where ${communityMutes.userId} = ${viewer} and ${communityMutes.postId} = ${event.postId})`,
  }).from(event).leftJoin(user, eq(event.actorId, user.id))
    .where(and(eq(event.userId, viewer), inArray(event.id, ids))) : [];
  const byId = new Map(rows.map(row => [row.id, row]));
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({
    notifications: groups.flatMap(group => {
      const row = byId.get(group.id ?? 0);
      if (!row) return [];
      if (!group.key.startsWith('spark:')) return [row];
      return [{ ...row, type: 'conversation', replyId: null, actorName: null, actorImage: null, actorUsername: null,
        message: group.size === 1 ? '1 new reply to your Spark.' : `${group.size} new replies to your Spark.` }];
    }),
    unread: total?.unread ?? 0,
  });
}
