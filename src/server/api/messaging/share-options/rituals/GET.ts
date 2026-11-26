/**
 * GET /api/messaging/share-options/rituals
 * Returns the current user's saved moon rituals for sharing.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;
  const [rows] = await db.execute(sql`
    SELECT id, ritual_name AS ritualName, moon_phase AS moonPhase, intention,
           scheduled_date AS scheduledDate, created_at AS createdAt
    FROM moon_rituals
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 30
  `);
  res.json({ rituals: rows });
}
