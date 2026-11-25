/**
 * POST /api/notifications/community-cursor
 *
 * Updates the authenticated user's community feed cursor to "now",
 * marking all current community posts as seen.
 * Called when the user visits /community or acknowledges the since-you-were-away banner.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { communityFeedCursors } from '@/server/db/schema.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const myId = session.user.id;

  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const now = new Date();

  // Upsert — insert on first visit, update on subsequent visits
  await db
    .insert(communityFeedCursors)
    .values({ userId: myId, lastSeenAt: now })
    .onDuplicateKeyUpdate({ set: { lastSeenAt: now, updatedAt: now } });

  res.json({ ok: true, lastSeenAt: now.toISOString() });
}
