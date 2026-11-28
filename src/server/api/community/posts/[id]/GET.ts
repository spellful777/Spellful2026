import { memberAvatar } from '@/server/lib/member-avatar.js';
import { communityLikePreviews } from '@/server/lib/community-like-previews.js';
import { sparkReshares } from '@/server/lib/spark-reshares.js';
import { loadOriginalSparks } from '@/server/lib/original-sparks.js';
import { postAudienceAllows } from '@/server/lib/community-post-access.js';
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityPosts, communityCategories, communityPolls, communityPollVotes, communityLikes, communityBookmarks, communityMutes, user } from '@/server/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  const myId = session?.user?.id;
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: 'Invalid id' });

  const [post] = await db.select({
    id: communityPosts.id,
    type: communityPosts.type,
    forumPost: communityPosts.forumPost,
    title: communityPosts.title,
    body: communityPosts.body,
    imageUrl: communityPosts.imageUrl,
      sparkMedia: communityPosts.sparkMedia, sparkTopic: communityPosts.sparkTopic, sparkReading: communityPosts.sparkReading,
      originalSparkId: communityPosts.originalSparkId, reshareOf: communityPosts.reshareOf,
    tags: communityPosts.tags,
    isPinned: communityPosts.isPinned,
    isLocked: communityPosts.isLocked,
    isHidden: communityPosts.isHidden,
    audience: communityPosts.audience,
    acceptedReplyId: communityPosts.acceptedReplyId,
    likeCount: communityPosts.likeCount,
    replyCount: communityPosts.replyCount,
    viewCount: communityPosts.viewCount,
    createdAt: communityPosts.createdAt,
    updatedAt: communityPosts.updatedAt,
    userId: communityPosts.userId,
    categoryId: communityPosts.categoryId,
    authorName: user.name,
    authorImage: memberAvatar,
    authorUsername: user.username,
    authorLocation: sql<string | null>`case when ${user.locationVisibility} = 'public' then ${user.location} else null end`,
    categoryName: communityCategories.name,
    categorySlug: communityCategories.slug,
  })
    .from(communityPosts)
    .leftJoin(user, eq(communityPosts.userId, user.id))
    .leftJoin(communityCategories, eq(communityPosts.categoryId, communityCategories.id))
    .where(and(eq(communityPosts.id, postId), postAudienceAllows(myId)))
    .limit(1);

  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.isHidden && post.userId !== myId) return res.status(404).json({ error: 'Post not found' });

  // Increment view count (fire-and-forget)
  db.update(communityPosts).set({ viewCount: sql`view_count + 1` }).where(eq(communityPosts.id, postId)).catch(() => {});

  // Poll
  let poll = null;
  const [pollRow] = await db.select().from(communityPolls).where(eq(communityPolls.postId, postId)).limit(1);
  if (pollRow) {
    const votes = await db.select({ choiceIndex: communityPollVotes.choiceIndex }).from(communityPollVotes).where(eq(communityPollVotes.pollId, pollRow.id));
    const tallies = (pollRow.choices as string[]).map((_, i) => votes.filter((v) => v.choiceIndex === i).length);
    let myVote: number | null = null;
    if (myId) {
      const [myVoteRow] = await db.select({ choiceIndex: communityPollVotes.choiceIndex }).from(communityPollVotes).where(and(eq(communityPollVotes.pollId, pollRow.id), eq(communityPollVotes.userId, myId))).limit(1);
      myVote = myVoteRow?.choiceIndex ?? null;
    }
    poll = { ...pollRow, tallies, totalVotes: votes.length, myVote };
  }

  // Liked / bookmarked / muted
  let liked = false, bookmarked = false, muted = false;
  if (myId) {
    const [likeRow, bookmarkRow, muteRow] = await Promise.all([
      db.select({ id: communityLikes.id }).from(communityLikes).where(and(eq(communityLikes.userId, myId), eq(communityLikes.targetType, 'post'), eq(communityLikes.targetId, postId))).limit(1),
      db.select({ id: communityBookmarks.id }).from(communityBookmarks).where(and(eq(communityBookmarks.userId, myId), eq(communityBookmarks.postId, postId))).limit(1),
      db.select({ id: communityMutes.id }).from(communityMutes).where(and(eq(communityMutes.userId, myId), eq(communityMutes.postId, postId))).limit(1),
    ]);
    liked = !!likeRow[0];
    bookmarked = !!bookmarkRow[0];
    muted = !!muteRow[0];
  }

  const originals = await loadOriginalSparks([post.originalSparkId], myId);
  const [reshares, previews] = await Promise.all([
    sparkReshares(post.type === 'spark' ? [post.reshareOf ?? post.id] : [], myId),
    myId ? communityLikePreviews('post', post.type === 'spark' ? [] : [post.id], myId) : new Map<number, string[]>(),
  ]);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ ...post, ...reshares.get(post.reshareOf ?? post.id), likedBy: previews.get(post.id) ?? [], originalSpark: originals.get(post.originalSparkId ?? 0) ?? null, poll, liked, bookmarked, muted, isOwner: myId === post.userId });
}
