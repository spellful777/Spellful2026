/**
 * GET /api/checkin/today
 *
 * Returns the current user's check-in state for today:
 *   - today's check-in (if completed)
 *   - current streak count
 *   - today's moon phase label (for the greeting)
 *
 * Auth: required
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { dailyCheckins } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getMoonPhase } from '@/lib/moon-phase-engine.js';

function todayDateStr(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const userId = session.user.id;
  const today = todayDateStr();

  // Today's check-in
  const [existing] = await db
    .select()
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, today)))
    .limit(1);

  // Current streak: count consecutive days ending today (or yesterday if not yet checked in today)
  const streak = existing?.streakCount ?? 0;

  // Moon phase for greeting
  const moon = getMoonPhase(new Date());

  res.json({
    completed: !!existing,
    checkin: existing ?? null,
    streak,
    moonPhase: moon.phase,
    moonIllumination: moon.illumination,
  });
}
