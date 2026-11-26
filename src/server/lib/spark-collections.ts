import type { Request, Response } from 'express';
import { and, countDistinct, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityBookmarks, communityLikes, communityPosts, user } from '@/server/db/schema.js';
import { getAuthSession } from './auth-session.js';
import { postAudienceAllows } from './community-post-access.js';
import { loadOriginalSparks } from './original-sparks.js';
import { sparkReshares } from './spark-reshares.js';

export async function sparkCollections(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  const viewer = (await getAuthSession(req))?.user?.id;
  if (!viewer) return res.sendStatus(401);
  const kind = req.query.kind;
  if (kind !== undefined && kind !== 'favorite' && kind !== 'saved') return res.sendStatus(400);
  const page = Math.min(10000, Math.max(1, Number(req.query.page) || 1));
  if (!Number.isSafeInteger(page)) return res.sendStatus(400);
  const liked = and(eq(communityLikes.userId, viewer), eq(communityLikes.targetType, 'post'), eq(communityLikes.targetId, communityPosts.id));
  const bookmarked = and(eq(communityBookmarks.userId, viewer), eq(communityBookmarks.postId, communityPosts.id));

  const visible = and(eq(communityPosts.type, 'spark'), eq(communityPosts.isHidden, false), postAudienceAllows(viewer),
    sql`(${communityPosts.originalSparkId} is null or exists (select 1 from community_posts as source
       where source.id = ${communityPosts.originalSparkId} and source.is_hidden = false and source.audience = 'public'
       and not exists (select 1 from community_blocks where
          (blocker_id = ${viewer} and blocked_id = source.user_id) or (blocked_id = ${viewer} and blocker_id = source.user_id))))`);
  const [[favorite], [saved]] = await Promise.all([
    db.select({ total: countDistinct(communityPosts.id) }).from(communityPosts).innerJoin(communityLikes, liked).where(visible),
    db.select({ total: countDistinct(communityPosts.id) }).from(communityPosts).innerJoin(communityBookmarks, bookmarked).where(visible),
  ]);
  const counts = { favorite: favorite.total, saved: saved.total };
  if (!kind) return res.json({ counts });
  const sort = kind === 'favorite' ? communityLikes.createdAt : communityBookmarks.createdAt;
  const items = await db.selectDistinct({
    id: communityPosts.id, type: communityPosts.type, title: communityPosts.title, createdAt: communityPosts.createdAt,
    audience: communityPosts.audience, likeCount: communityPosts.likeCount, replyCount: communityPosts.replyCount,
    sparkMedia: communityPosts.sparkMedia, sparkTopic: communityPosts.sparkTopic, sparkReading: communityPosts.sparkReading, imageUrl: communityPosts.imageUrl, originalSparkId: communityPosts.originalSparkId,
    reshareOf: communityPosts.reshareOf, authorName: user.name, authorUsername: user.username, authorImage: user.image,
    liked: sql<boolean>`${communityLikes.id} is not null`, bookmarked: sql<boolean>`${communityBookmarks.id} is not null`,
    collectedAt: sort,
  }).from(communityPosts).innerJoin(user, eq(user.id, communityPosts.userId))
    .leftJoin(communityLikes, liked).leftJoin(communityBookmarks, bookmarked)
    .where(and(visible, kind === 'favorite' ? sql`${communityLikes.id} is not null` : sql`${communityBookmarks.id} is not null`))
    .orderBy(desc(sort), desc(communityPosts.id)).limit(24).offset((page - 1) * 24);
  const [originals, reshares] = await Promise.all([
    loadOriginalSparks(items.map(item => item.originalSparkId), viewer),
    sparkReshares(items.map(item => item.reshareOf ?? item.id), viewer),
  ]);
  return res.json({ counts, posts: items.map(item => ({
    ...item, liked: !!item.liked, bookmarked: !!item.bookmarked,
    ...reshares.get(item.reshareOf ?? item.id), originalSpark: originals.get(item.originalSparkId ?? 0),
  })) });
}
