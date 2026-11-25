/**
 * POST /api/checkin/today
 *
 * Body: { mood: string; intention: string; saveToGrimoire?: boolean }
 *
 * Creates today's check-in for the current user. Idempotent — returns
 * the existing check-in if already completed today.
 * Optionally saves a grimoire entry of type 'journal'.
 *
 * Auth: required
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { dailyCheckins, grimoireEntries } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getMoonPhase } from '@/lib/moon-phase-engine.js';

function todayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayDateStr(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const VALID_MOODS = [
  'grounded', 'curious', 'restless', 'grateful', 'hopeful',
  'tender', 'energised', 'reflective', 'playful', 'weary',
];
const VALID_INTENTIONS = [
  'clarity', 'healing', 'creativity', 'protection', 'abundance',
  'love', 'release', 'growth', 'peace', 'courage',
];

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const userId = session.user.id;
  const today = todayDateStr();

  const { mood, intention, saveToGrimoire = false } = req.body as {
    mood: string;
    intention: string;
    saveToGrimoire?: boolean;
  };

  if (!VALID_MOODS.includes(mood)) { res.status(400).json({ error: 'Invalid mood' }); return; }
  if (!VALID_INTENTIONS.includes(intention)) { res.status(400).json({ error: 'Invalid intention' }); return; }

  // Idempotency — already checked in today
  const [existing] = await db
    .select()
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, today)))
    .limit(1);

  if (existing) { res.json({ checkin: existing, streak: existing.streakCount, alreadyDone: true }); return; }

  // Compute streak: did the user check in yesterday?
  const yesterday = yesterdayDateStr();
  const [prevCheckin] = await db
    .select({ streakCount: dailyCheckins.streakCount })
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, yesterday)))
    .limit(1);

  const streak = prevCheckin ? prevCheckin.streakCount + 1 : 1;

  // Moon phase
  const moon = getMoonPhase(new Date());
  const moonPhase = moon.phase;

  // Optionally save to grimoire first
  let grimoireEntryId: number | null = null;
  if (saveToGrimoire) {
    const moodLabel = mood.charAt(0).toUpperCase() + mood.slice(1);
    const intentionLabel = intention.charAt(0).toUpperCase() + intention.slice(1);
    const result = await db.insert(grimoireEntries).values({
      userId,
      type: 'journal',
      title: 'Daily Check-In — ' + today,
      content: 'Mood: ' + moodLabel + '\nIntention: ' + intentionLabel + '\nMoon: ' + moonPhase,
      moonPhase,
      entryDate: today,
      tags: 'check-in,daily',
      metadata: { mood, intention, streak },
    });
    grimoireEntryId = (result as { insertId: number }).insertId ?? null;
  }

  // Insert check-in
  await db.insert(dailyCheckins).values({
    userId,
    checkinDate: today,
    mood,
    intention,
    moonPhase,
    savedToGrimoire: saveToGrimoire,
    grimoireEntryId,
    streakCount: streak,
  });

  const [created] = await db
    .select()
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.checkinDate, today)))
    .limit(1);

  res.status(201).json({ checkin: created, streak, alreadyDone: false });
}
