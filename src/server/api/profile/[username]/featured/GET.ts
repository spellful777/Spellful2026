import { profileAudience } from '@/server/lib/profile-audience.js';
/**
 * GET /api/profile/:username/featured
 * Returns featured posts/grimoire entries for a profile.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, profileFeatured, communityPosts } from '@/server/db/schema.js';
import { eq, and, or, inArray } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { postAudienceAllows } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const session = await getAuthSession(req);
  const viewerId = session?.user?.id ?? null;
  const normalized = req.params.username.toLowerCase();

  const [profile] = await db
    .select({ id: user.id, profileVisibility: user.profileVisibility, sections: user.profileSections })
    .from(user).where(eq(user.usernameNormalized, normalized)).limit(1);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  res.setHeader('Cache-Control', 'private, no-store');
  const access = await profileAudience(profile, viewerId, req.query.preview);
  if (!access?.allowed || (!access.owner && profile.sections?.some(section => section.id === 'featured' && !section.enabled)))
    return res.status(404).json({ error: 'Profile unavailable' });

  const featured = await db
    .select()
    .from(profileFeatured)
    .where(eq(profileFeatured.userId, profile.id))
    .orderBy(profileFeatured.sortOrder);

  const postIds = featured.filter(f => f.itemType === 'post').map(f => f.itemId);
  let posts: { id: number; title: string; createdAt: Date | null; audience: string | null }[] = [];
  if (postIds.length) {
    posts = await db
      .select({ id: communityPosts.id, title: communityPosts.title, createdAt: communityPosts.createdAt, audience: communityPosts.audience })
      .from(communityPosts)
      .where(and(inArray(communityPosts.id, postIds), eq(communityPosts.isHidden, false), access.preview ? (access.coven ? or(eq(communityPosts.audience, 'public'), and(eq(communityPosts.audience, 'coven'), eq(communityPosts.userId, profile.id))) : eq(communityPosts.audience, 'public')) : postAudienceAllows(viewerId ?? undefined)));
  }

  const visiblePostIds = new Set(posts.map(post => post.id));
  res.json({ featured: featured.filter(item => item.itemType !== 'post' || visiblePostIds.has(item.itemId)), posts });
}
