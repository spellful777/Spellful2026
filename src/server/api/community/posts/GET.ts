import { getBlockedUserIds } from '@/server/lib/block-check.js';
import { memberAvatar } from '@/server/lib/member-avatar.js';
import { findTopic } from '@/lib/spark-topics';
import { communityLikePreviews } from '@/server/lib/community-like-previews.js';
import { sparkReshares } from '@/server/lib/spark-reshares.js';
import { loadOriginalSparks } from '@/server/lib/original-sparks.js';
import { covenWithPostAuthor, followsPostAuthor, postAudienceAllows, forumAllows } from '@/server/lib/community-post-access.js';
/**
 * GET /api/community/posts
 * Query params: filter (all|latest|chronological|personalized|popular|trending|unanswered|following|mine), category, kind (spark|discussion), page, limit
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityPosts, communityReplies, communityCategories, communityLikes, communityBookmarks, user } from '@/server/db/schema.js';
import { eq, and, desc, gt, gte, ne, sql, inArray, notInArray } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  const topic = findTopic(req.query.topic);
  if (req.query.topic !== undefined && !topic) return res.status(404).json({ error: 'Topic not found' });
  const publicExplore = req.query.filter === 'feed' || (typeof req.query.category === 'string' && ['active','chronological'].includes(String(req.query.filter))) || (req.query.filter === 'discover' && req.query.kind === 'spark');
  if (!session?.user?.id && !topic && !publicExplore) return res.status(401).json({ error: 'Sign in to view the community' });
  const myId = session?.user?.id;

  const filter = (req.query.filter as string) || 'latest';
  const categorySlug = req.query.category as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  // Resolve category id
  let categoryId: number | undefined;
  if (categorySlug) {
    const [cat] = await db.select({ id: communityCategories.id }).from(communityCategories).where(and(eq(communityCategories.slug, categorySlug), forumAllows(myId))).limit(1);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    categoryId = cat.id;
  }

  const conditions = [eq(communityPosts.isHidden, false), postAudienceAllows(myId)];
  if (topic) conditions.push(eq(communityPosts.sparkTopic, topic), eq(communityPosts.type, 'spark'));
  if (req.query.kind === 'spark') conditions.push(eq(communityPosts.type, 'spark'));
  if (req.query.kind === 'discussion') conditions.push(ne(communityPosts.type, 'spark'));
  if (categoryId) conditions.push(eq(communityPosts.categoryId, categoryId));
  if (filter === 'unanswered') conditions.push(eq(communityPosts.replyCount, 0));
  if (filter === 'mine' && myId) conditions.push(eq(communityPosts.userId, myId));
  const follows = myId ? followsPostAuthor(myId) : sql`false`;
  if (filter === 'following') conditions.push(follows);
  if (filter === 'feed' && myId) conditions.push(sql`(${communityPosts.userId} = ${myId} or ${follows} or ${covenWithPostAuthor(myId)} or
    ${communityPosts.type} <> 'spark' or ${communityPosts.forumPost} = true or ${communityPosts.sparkTopic} is not null)`);
  if (categoryId && req.query.forum === '1') conditions.push(sql`(${communityPosts.type} <> 'spark' or ${communityPosts.forumPost} = true)`);
  if (req.query.beforeId !== undefined) {
    const id = Number(req.query.beforeId);
    if (!Number.isSafeInteger(id) || id <= 0 || typeof req.query.beforeTime !== 'string') return res.sendStatus(400);
    const date = new Date(req.query.beforeTime);
    if (!Number.isFinite(date.getTime())) return res.sendStatus(400);
    conditions.push(sql`(${communityPosts.createdAt} < ${date} or (${communityPosts.createdAt} = ${date} and ${communityPosts.id} < ${id}))`);
  }
  if (filter === 'discover' && myId) {
    conditions.push(eq(communityPosts.audience, 'public'), ne(communityPosts.userId, myId), sql`not ${follows}`);
  }

  if (typeof req.query.afterId === 'string') {
    const afterId = Number(req.query.afterId);
    if (!Number.isSafeInteger(afterId) || afterId < 0) {
      return res.status(400).json({ error: 'Invalid post cursor' });
    }
    const [newPost] = await db.select({ id: communityPosts.id }).from(communityPosts)
      .where(and(...conditions, gt(communityPosts.id, afterId))).limit(1);
    return res.json({ hasNewPosts: Boolean(newPost) });
  }


  const recent = [desc(communityPosts.createdAt), desc(communityPosts.id)];
  let orderBy = [desc(communityPosts.isPinned), ...recent];
  if (['feed', 'following', 'chronological'].includes(filter)) orderBy = recent;
  if (filter === 'discover') {
    const fresh = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const priority = sql`case
      when ${communityPosts.createdAt} >= ${fresh} and ${communityPosts.type} = 'question'
        and coalesce(${communityPosts.replyCount}, 0) < 3 then 2
      when ${communityPosts.createdAt} >= ${fresh} and coalesce(${communityPosts.replyCount}, 0) < 3 then 1
      else 0 end`;
    orderBy = [desc(priority), ...recent];
  }
  const blocked = myId ? [...await getBlockedUserIds(myId)] : [];
  if (filter === 'active') {
    const visibleReply = blocked.length ? notInArray(communityReplies.userId, blocked) : sql`true`;
    orderBy = [desc(sql`coalesce((select max(${communityReplies.createdAt}) from ${communityReplies}
      where ${communityReplies.postId} = ${communityPosts.id} and ${communityReplies.isHidden} = false and ${visibleReply}), ${communityPosts.createdAt})`), ...recent];
  }
  if (filter === 'personalized') orderBy = [desc(follows), ...recent];
  if (filter === 'popular') orderBy = [desc(communityPosts.likeCount), desc(communityPosts.replyCount), ...recent];

  if (filter === 'trending') {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const engagement = sql`coalesce(${communityPosts.likeCount}, 0) + 2 * coalesce(${communityPosts.replyCount}, 0)`;
    conditions.push(gte(communityPosts.createdAt, since), sql`${engagement} > 0`);
    orderBy = [desc(engagement), ...recent];
  }

  const [posts, [{ total, newestId }]] = await Promise.all([
    db.select({
      id: communityPosts.id,
      type: communityPosts.type, forumPost: communityPosts.forumPost,
      title: communityPosts.title,
      preview: sql<string>`left(${communityPosts.body}, 280)`,
      tags: communityPosts.tags,
      audience: communityPosts.audience,
      imageUrl: communityPosts.imageUrl,
      sparkMedia: communityPosts.sparkMedia, sparkTopic: communityPosts.sparkTopic, sparkReading: communityPosts.sparkReading,
      originalSparkId: communityPosts.originalSparkId, reshareOf: communityPosts.reshareOf,
      isPinned: communityPosts.isPinned,
      isLocked: communityPosts.isLocked,
      likeCount: communityPosts.likeCount,
      replyCount: communityPosts.replyCount,
      viewCount: communityPosts.viewCount,
      acceptedReplyId: communityPosts.acceptedReplyId,
      createdAt: communityPosts.createdAt,
      categoryId: communityPosts.categoryId,
      userId: communityPosts.userId,
      authorName: user.name,
      authorImage: memberAvatar,
      authorPreset: user.avatarPreset,
      authorFrame: user.avatarFrame,
      authorUsername: user.username,
      categoryName: communityCategories.name,
      categorySlug: communityCategories.slug,
    })
      .from(communityPosts)
      .leftJoin(user, eq(communityPosts.userId, user.id))
      .leftJoin(communityCategories, eq(communityPosts.categoryId, communityCategories.id))
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)`, newestId: sql<number | null>`max(${communityPosts.id})` }).from(communityPosts).where(and(...conditions)),
  ]);

  // Attach liked/bookmarked state for authenticated user
  let likedIds = new Set<number>();
  let bookmarkedIds = new Set<number>();
  if (myId && posts.length) {
    const postIds = posts.map((p) => p.id);
    const [likes, bookmarks] = await Promise.all([
      db.select({ targetId: communityLikes.targetId }).from(communityLikes).where(and(eq(communityLikes.userId, myId), eq(communityLikes.targetType, 'post'), inArray(communityLikes.targetId, postIds))),
      db.select({ postId: communityBookmarks.postId }).from(communityBookmarks).where(and(eq(communityBookmarks.userId, myId), inArray(communityBookmarks.postId, postIds))),
    ]);
    likedIds = new Set(likes.map((l) => l.targetId));
    bookmarkedIds = new Set(bookmarks.map((b) => b.postId));
  }

  const activePosts = posts.filter(p => p.replyCount).map(p => p.id);
  const replyPreviews = new Map<number, {id: number; body: string; gifUrl: string | null; name: string | null; username: string | null}[]>();
  if (activePosts.length) {
    const ranked = db.select({ id: communityReplies.id, postId: communityReplies.postId,
      body: communityReplies.body, gifUrl: communityReplies.gifUrl, name: user.name, username: user.username,
      rank: sql<number>`row_number() over(partition by ${communityReplies.postId} order by ${communityReplies.id})`.as('reply_rank'),
    }).from(communityReplies).innerJoin(user, eq(user.id, communityReplies.userId))
      .where(and(inArray(communityReplies.postId, activePosts), eq(communityReplies.isHidden, false),
        blocked.length ? notInArray(communityReplies.userId, blocked) : undefined)).as('ranked');
    const rows = await db.select().from(ranked).where(sql`${ranked.rank} <= 2`).orderBy(ranked.id);
    for (const { postId, rank, ...reply } of rows) {
      const group = replyPreviews.get(postId) ?? [];
      group.push(reply);
      replyPreviews.set(postId, group);
    }
  }
  const originals = await loadOriginalSparks(posts.map(post => post.originalSparkId), myId);
  const reshares = await sparkReshares(posts.filter(post => post.type === 'spark').map(post => post.reshareOf ?? post.id), myId);
  const previews = myId ? await communityLikePreviews('post', posts.filter(post => post.type !== 'spark').map(post => post.id), myId) : new Map<number, string[]>();
  res.setHeader('Cache-Control', 'private, no-store');
  const pages = Math.ceil(total / limit);
  res.json({
    posts: posts.map((p) => ({ ...p, replyPreviews: replyPreviews.get(p.id) ?? [], likedBy: previews.get(p.id) ?? [], ...reshares.get(p.reshareOf ?? p.id), originalSpark: originals.get(p.originalSparkId ?? 0) ?? null, liked: likedIds.has(p.id), bookmarked: bookmarkedIds.has(p.id) })),
    total,
    newestId: newestId ?? 0,
    page,
    pages,
  });
}
