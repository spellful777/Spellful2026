import { selectRows } from '@/server/db/select-rows';
/**
 * GET /api/email-preferences?token=...
 * Returns the current marketing consent state for the user identified by the token.
 * No login required — token carries the userId.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { verifyMomentsToken } from '@/server/lib/moments-tokens.js';

export const MARKETING_CATEGORIES = [
  { id: 'birthday',      label: 'Birthday Wishes',       desc: 'A personal greeting on your birthday each year.' },
  { id: 'moon_seasonal', label: 'Moon & Seasonal',        desc: 'New moon, full moon, and Wheel of the Year sabbat emails.' },
  { id: 'community',     label: 'Community & Events',     desc: 'Coven updates, community highlights, and re-engagement.' },
  { id: 'discovery',     label: 'Feature Tips',           desc: 'Discover new Spellful features and resources.' },
  { id: 'plus_offers',   label: 'Spellful Plus Offers',   desc: 'Occasional invitations to explore Spellful Plus (free members only).' },
] as const;

interface ConsentRow { category: string; consented: boolean }

export default async function handler(req: Request, res: Response) {
  const token = typeof req.query.token === 'string' ? req.query.token : '';
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const payload = await verifyMomentsToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const [rows] = await db.execute<ConsentRow>(
    sql`SELECT category, consented FROM marketing_consent WHERE user_id = ${payload.sub}`,
  );

  const consentMap: Record<string, boolean> = {};
  for (const row of selectRows<ConsentRow>(rows)) {
    consentMap[row.category] = Boolean(row.consented);
  }

  const categories = MARKETING_CATEGORIES.map(c => ({
    ...c,
    consented: consentMap[c.id] ?? false,
  }));

  return res.json({ userId: payload.sub, categories, token });
}
