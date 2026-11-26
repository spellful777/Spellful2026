import { postAudienceAllows } from '@/server/lib/community-post-access.js';
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityPosts, communityCategories, user } from '@/server/db/schema.js';
import { eq, and, like, or, desc, sql, type SQL } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to search the community' });
  const myId = session.user.id;

  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 200) : '';
  const tag = typeof req.query.tag === 'string' ? req.query.tag.trim().slice(0, 500) : '';
  const category = req.query.category as string | undefined;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.max(1, Math.min(30, parseInt(req.query.limit as string) || 15));
  const offset = (page - 1) * limit;

  if (!q && !tag) return res.json({ posts: [], total: 0, hasMore: false });

  const conditions: (SQL | undefined)[] = [
    eq(communityPosts.isHidden, false),
    postAudienceAllows(myId),
  ];
  if (q) {
    conditions.push(or(like(communityPosts.title, `%${q}%`), like(communityPosts.body, `%${q}%`), like(communityPosts.tags, `%${q}%`)));
  }
  if (tag) {
    conditions.push(sql`locate(concat(',', lower(${tag}), ','), concat(',', replace(replace(lower(trim(${communityPosts.tags})), ', ', ','), ' ,', ','), ',')) > 0`);
  }
  if (category) {
    const [cat] = await db.select({ id: communityCategories.id }).from(communityCategories).where(eq(communityCategories.slug, category)).limit(1);
    if (cat) conditions.push(eq(communityPosts.categoryId, cat.id));
  }

  const posts = await db.select({
    id: communityPosts.id,
    type: communityPosts.type,
    title: communityPosts.title,
    tags: communityPosts.tags,
    likeCount: communityPosts.likeCount,
    replyCount: communityPosts.replyCount,
    createdAt: communityPosts.createdAt,
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
    .orderBy(desc(communityPosts.createdAt), desc(communityPosts.id))
    .limit(limit + 1)
    .offset(offset);

  const visible = posts.slice(0, limit);
  res.json({ posts: visible, total: visible.length, hasMore: posts.length > limit });
}
