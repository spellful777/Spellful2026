import type { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityCategories, forumMemberships } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const viewer = (await getAuthSession(req))?.user.id;
  if (!viewer) return res.sendStatus(401);
  const { categoryId, joined } = req.body;
  if (!Number.isSafeInteger(categoryId) || typeof joined !== 'boolean') return res.sendStatus(400);
  const [category] = await db.select({ id: communityCategories.id }).from(communityCategories)
    .where(and(eq(communityCategories.id, categoryId), eq(communityCategories.isActive, true), joined ? eq(communityCategories.membersOnly, false) : undefined)).limit(1);
  if (!category) return res.sendStatus(404);
  if (joined) await db.insert(forumMemberships).values({ categoryId, userId: viewer }).onDuplicateKeyUpdate({ set: { categoryId } });
  else await db.delete(forumMemberships).where(and(eq(forumMemberships.categoryId, categoryId), eq(forumMemberships.userId, viewer)));
  res.json({ joined });
}
