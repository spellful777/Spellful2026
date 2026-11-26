import { getBlockedUserIds } from '@/server/lib/block-check.js';
import { postAudienceAllows } from '@/server/lib/community-post-access.js';
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityBookmarks, communityPosts, communityCategories, communityReplyFavorites, communityReplies, user } from '@/server/db/schema.js';
import { eq, and, desc, notInArray } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const bookmarks = await db.select({
    bookmarkId: communityBookmarks.id,
    bookmarkedAt: communityBookmarks.createdAt,
    id: communityPosts.id,
    type: communityPosts.type,
    title: communityPosts.title,
    tags: communityPosts.tags,
    likeCount: communityPosts.likeCount,
    replyCount: communityPosts.replyCount,
    createdAt: communityPosts.createdAt,
    isHidden: communityPosts.isHidden,
    authorName: user.name,
    authorImage: user.image,
    authorUsername: user.username,
    categoryName: communityCategories.name,
    categorySlug: communityCategories.slug,
  })
    .from(communityBookmarks)
    .leftJoin(communityPosts, eq(communityBookmarks.postId, communityPosts.id))
    .leftJoin(user, eq(communityPosts.userId, user.id))
    .leftJoin(communityCategories, eq(communityPosts.categoryId, communityCategories.id))
    .where(and(eq(communityBookmarks.userId, session.user.id), postAudienceAllows(session.user.id), eq(communityPosts.isHidden, false)))
    .orderBy(desc(communityBookmarks.createdAt));

  const viewer = session.user.id;
  const blocked = [...await getBlockedUserIds(viewer)];
  const replyFavorites = await db.select({
    bookmarkId: communityReplyFavorites.replyId,
    replyId: communityReplyFavorites.replyId,
    bookmarkedAt: communityReplyFavorites.createdAt,
    id: communityReplies.postId,
    title: communityReplies.body,
    likeCount: communityReplies.likeCount,
    authorName: user.name,
  }).from(communityReplyFavorites)
    .innerJoin(communityReplies, eq(communityReplies.id, communityReplyFavorites.replyId))
    .innerJoin(communityPosts, eq(communityPosts.id, communityReplies.postId))
    .leftJoin(user, eq(communityReplies.userId, user.id))
    .where(and(eq(communityReplyFavorites.userId, viewer), eq(communityPosts.isHidden, false),
      eq(communityReplies.isHidden, false), postAudienceAllows(viewer),
      blocked.length ? notInArray(communityReplies.userId, blocked) : undefined));
  res.json([...bookmarks, ...replyFavorites].sort((a, b) =>
    (b.bookmarkedAt?.getTime() ?? 0) - (a.bookmarkedAt?.getTime() ?? 0)));

}
