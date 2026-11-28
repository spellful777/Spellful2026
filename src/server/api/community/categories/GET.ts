import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityCategories, communityPosts, forumMemberships } from '@/server/db/schema.js';
import { postAudienceAllows, forumAllows } from '@/server/lib/community-post-access.js';
import { eq, ne, count, and, or } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  const viewer = session?.user?.id;
  const cats = await db
    .select({
      id: communityCategories.id,
      name: communityCategories.name,
      slug: communityCategories.slug,
      description: communityCategories.description,
      icon: communityCategories.icon,
      sortOrder: communityCategories.sortOrder,
    })
    .from(communityCategories)
    .where(forumAllows(viewer))
    .orderBy(communityCategories.sortOrder);

  // Get post counts per category
  const counts = await db
    .select({ categoryId: communityPosts.categoryId, total: count() })
    .from(communityPosts)
    .where(and(eq(communityPosts.isHidden, false), postAudienceAllows(viewer), or(ne(communityPosts.type, 'spark'), eq(communityPosts.forumPost, true))))
    .groupBy(communityPosts.categoryId);

  const countMap = new Map(counts.map((c) => [c.categoryId, c.total]));

  const joined = viewer ? await db.select({ id: forumMemberships.categoryId }).from(forumMemberships).where(eq(forumMemberships.userId, viewer)) : [];
  const ids = new Set(joined.map(c => c.id));
  res.setHeader('Cache-Control', 'private, no-store');
  res.json(cats.map((c) => ({ ...c, joined: ids.has(c.id), postCount: countMap.get(c.id) ?? 0 })));
}
