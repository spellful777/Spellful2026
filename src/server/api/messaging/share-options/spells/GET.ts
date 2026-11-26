/**
 * GET /api/messaging/share-options/spells
 * Returns spells the current user can share in a DM.
 * Returns public/approved spells + user's own submitted spells.
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
    SELECT id, title, subtitle, intention, difficulty, duration_minutes AS durationMinutes, moon_phase AS moonPhase
    FROM spells
    WHERE (status = 'approved' OR submitted_by_user_id = ${userId})
    ORDER BY title ASC
    LIMIT 50
  `);
  res.json({ spells: rows });
}
