/**
 * GET /api/community/announcements
 * Returns published announcements, newest first. Pinned items always first.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityAnnouncements, user } from '@/server/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const type = req.query.type as string | undefined;

  const conditions = [eq(communityAnnouncements.isPublished, true)];
  if (type) conditions.push(eq(communityAnnouncements.type, type));

  const rows = await db
    .select({
      id: communityAnnouncements.id,
      type: communityAnnouncements.type,
      title: communityAnnouncements.title,
      body: communityAnnouncements.body,
      isPinned: communityAnnouncements.isPinned,
      publishedAt: communityAnnouncements.publishedAt,
      authorId: communityAnnouncements.authorId,
      authorName: user.name,
      authorUsername: user.username,
    })
    .from(communityAnnouncements)
    .leftJoin(user, eq(communityAnnouncements.authorId, user.id))
    .where(and(...conditions))
    .orderBy(desc(communityAnnouncements.isPinned), desc(communityAnnouncements.publishedAt))
    .limit(50);

  return res.json({ announcements: rows });
}
