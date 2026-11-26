/**
 * GET /api/messaging/share-options/tarot-readings
 * Returns the current user's recent tarot readings for sharing.
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
    SELECT id, spread_type AS spreadType, spread_name AS spreadName,
           intention, moon_phase AS moonPhase, created_at AS createdAt,
           JSON_LENGTH(cards) AS cardCount
    FROM tarot_readings
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 20
  `);
  res.json({ readings: rows });
}
