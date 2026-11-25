/**
 * PATCH /api/moments/status
 * Owner-only: pause or resume the Moments scheduler.
 * Body: { paused: boolean }
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'owner')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const { paused } = req.body as { paused?: boolean };
  if (typeof paused !== 'boolean') return res.status(400).json({ error: 'paused must be boolean' });

  await db.execute(
    sql`UPDATE moments_scheduler_state SET paused = ${paused ? 1 : 0} WHERE id = 1`,
  );

  return res.json({ ok: true, paused });
}
