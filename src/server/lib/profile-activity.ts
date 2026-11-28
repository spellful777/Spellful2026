import { memberAvatar } from '@/server/lib/member-avatar.js';
import { sparkReshares } from '@/server/lib/spark-reshares.js';
import { and, desc, eq, lt, or, isNotNull, inArray } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { user, communityPosts, communityReplies, communityLikes, communityBookmarks, communityCategories, profileFeatured } from '@/server/db/schema.js';
import { postAudienceAllows, postForumAllows } from './community-post-access.js';
import { profileAudience } from './profile-audience.js';
import { loadOriginalSparks } from './original-sparks.js';

export async function profileActivity(
  profileId: string,
  access: NonNullable<Awaited<ReturnType<typeof profileAudience>>>,
  viewer: string | null,
  tab: 'sparks' | 'replies' | 'media',
  before: number,
) {
  const limit = 24;
  const viewingAs = access.preview ? undefined : viewer ?? undefined;
  const audience = access.preview && access.coven
    ? and(postForumAllows(), or(eq(communityPosts.audience, 'public'), and(eq(communityPosts.audience, 'coven'), eq(communityPosts.userId, profileId))))
    : postAudienceAllows(viewingAs);
  const visible = and(eq(communityPosts.isHidden, false), audience);
  if (tab === 'replies') {
    const rows = await db.select({
      id: communityReplies.id, postId: communityPosts.id, body: communityReplies.body, createdAt: communityReplies.createdAt,
      gifUrl: communityReplies.gifUrl, originalAuthor: user.username, originalName: user.name, originalText: communityPosts.title,
    }).from(communityReplies).innerJoin(communityPosts, eq(communityPosts.id, communityReplies.postId))
      .leftJoin(user, eq(user.id, communityPosts.userId))
      .where(and(visible, eq(communityReplies.userId, profileId), eq(communityReplies.isHidden, false),
        before ? lt(communityReplies.id, before) : undefined))
      .orderBy(desc(communityReplies.id)).limit(limit + 1);
    return { replies: rows.slice(0, limit), next: rows.length > limit ? rows[limit - 1].id : null };
  }

  const selection = {
    id: communityPosts.id, title: communityPosts.title, type: communityPosts.type, createdAt: communityPosts.createdAt,
    forumPost: communityPosts.forumPost, categoryName: communityCategories.name, categorySlug: communityCategories.slug,
    audience: communityPosts.audience, userId: communityPosts.userId, authorName: user.name, authorUsername: user.username, authorImage: memberAvatar,
    authorFrame: user.avatarFrame, authorPreset: user.avatarPreset,
    likeCount: communityPosts.likeCount, replyCount: communityPosts.replyCount, originalSparkId: communityPosts.originalSparkId, reshareOf: communityPosts.reshareOf,
    sparkMedia: communityPosts.sparkMedia, sparkTopic: communityPosts.sparkTopic, sparkReading: communityPosts.sparkReading, imageUrl: communityPosts.imageUrl,
  };
  const rows = await db.select(selection).from(communityPosts).innerJoin(user, eq(user.id, communityPosts.userId))
    .innerJoin(communityCategories, eq(communityCategories.id, communityPosts.categoryId))
    .where(and(visible, eq(communityPosts.userId, profileId), before ? lt(communityPosts.id, before) : undefined,
      tab === 'media' ? or(isNotNull(communityPosts.sparkMedia), isNotNull(communityPosts.imageUrl), isNotNull(communityPosts.originalSparkId)) : undefined))
    .orderBy(desc(communityPosts.id)).limit(limit + 1);

  const pins = tab === 'sparks' && !before ? await db.select(selection).from(profileFeatured)
    .innerJoin(communityPosts, eq(communityPosts.id, profileFeatured.itemId)).innerJoin(user, eq(user.id, communityPosts.userId))
    .innerJoin(communityCategories, eq(communityCategories.id, communityPosts.categoryId))
    .where(and(visible, eq(profileFeatured.userId, profileId), eq(profileFeatured.itemType, 'post')))
    .orderBy(profileFeatured.sortOrder).limit(1) : [];
  const visiblePins = pins;
  const posts = [...visiblePins, ...rows.slice(0, limit).filter(post => !visiblePins.some(pin => pin.id === post.id))];
  const ids = posts.map(post => post.id);
  const [likes, saves, originals] = await Promise.all([
    viewingAs && ids.length ? db.select({ id: communityLikes.targetId }).from(communityLikes)
      .where(and(eq(communityLikes.userId, viewingAs), eq(communityLikes.targetType, 'post'), inArray(communityLikes.targetId, ids))) : [],
    viewingAs && ids.length ? db.select({ id: communityBookmarks.postId }).from(communityBookmarks)
      .where(and(eq(communityBookmarks.userId, viewingAs), inArray(communityBookmarks.postId, ids))) : [],
    loadOriginalSparks(posts.map(post => post.originalSparkId), viewingAs),
  ]);
  const reshares = await sparkReshares(posts.map(post => post.reshareOf ?? post.id), viewingAs);
  return {
    posts: posts.map(post => ({ ...post, ...reshares.get(post.reshareOf ?? post.id), featured: visiblePins.some(pin => pin.id === post.id),
      liked: likes.some(like => like.id === post.id), bookmarked: saves.some(save => save.id === post.id),
      originalSpark: originals.get(post.originalSparkId ?? 0) ?? null })),
    next: rows.length > limit ? rows[limit - 1].id : null,
  };
}
