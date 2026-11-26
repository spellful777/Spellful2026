import { followsPostAuthor, postAudienceAllows } from '@/server/lib/community-post-access.js';
/**
 * GET /api/community/posts
 * Query params: filter (all|latest|chronological|personalized|popular|trending|unanswered|following|mine), category, page, limit
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityPosts, communityCategories, communityLikes, communityBookmarks, user } from '@/server/db/schema.js';
import { eq, and, desc, gt, gte, ne, sql, inArray } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to view the community' });
  const myId = session.user.id;

  const filter = (req.query.filter as string) || 'latest';
  const categorySlug = req.query.category as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;

  // Resolve category id
  let categoryId: number | undefined;
  if (categorySlug) {
    const [cat] = await db.select({ id: communityCategories.id }).from(communityCategories).where(eq(communityCategories.slug, categorySlug)).limit(1);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    categoryId = cat.id;
  }

  const conditions = [eq(communityPosts.isHidden, false), postAudienceAllows(myId)];
  if (categoryId) conditions.push(eq(communityPosts.categoryId, categoryId));
  if (filter === 'unanswered') conditions.push(eq(communityPosts.replyCount, 0));
  if (filter === 'mine' && myId) conditions.push(eq(communityPosts.userId, myId));
  const follows = followsPostAuthor(myId);
  if (filter === 'following') conditions.push(follows);
  if (filter === 'discover') {
    conditions.push(ne(communityPosts.userId, myId), sql`not ${follows}`);
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
  if (filter === 'chronological' || (filter === 'following' && req.query.order === 'newest')) orderBy = recent;
  if (filter === 'discover') {
    const fresh = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const priority = sql`case
      when ${communityPosts.createdAt} >= ${fresh} and ${communityPosts.type} = 'question'
        and coalesce(${communityPosts.replyCount}, 0) < 3 then 2
      when ${communityPosts.createdAt} >= ${fresh} and coalesce(${communityPosts.replyCount}, 0) < 3 then 1
      else 0 end`;
    orderBy = [desc(priority), ...recent];
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
      type: communityPosts.type,
      title: communityPosts.title,
      preview: sql<string>`left(${communityPosts.body}, 280)`,
      tags: communityPosts.tags,
      imageUrl: communityPosts.imageUrl,
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
      authorImage: user.image,
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

  const pages = Math.ceil(total / limit);
  res.json({
    posts: posts.map((p) => ({ ...p, liked: likedIds.has(p.id), bookmarked: bookmarkedIds.has(p.id) })),
    total,
    newestId: newestId ?? 0,
    page,
    pages,
  });
}
