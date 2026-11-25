/**
 * POST /api/email-preferences
 * Saves marketing consent preferences for the user identified by the token.
 * No login required — token carries the userId.
 * Body: { token: string; categories: Record<string, boolean> }
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { verifyMomentsToken } from '@/server/lib/moments-tokens.js';
import { MARKETING_CATEGORIES } from './GET.js';

export default async function handler(req: Request, res: Response) {
  const { token, categories } = req.body as { token?: string; categories?: Record<string, boolean> };
  if (!token) return res.status(400).json({ error: 'Missing token' });
  if (!categories || typeof categories !== 'object') return res.status(400).json({ error: 'Missing categories' });

  const payload = await verifyMomentsToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const validIds = new Set<string>(MARKETING_CATEGORIES.map(c => c.id));
  const updates: { category: string; consented: boolean }[] = [];

  for (const [cat, val] of Object.entries(categories)) {
    if (validIds.has(cat)) {
      updates.push({ category: cat, consented: Boolean(val) });
    }
  }

  for (const { category, consented } of updates) {
    await db.execute(
      sql`INSERT INTO marketing_consent (user_id, category, consented, source, version)
          VALUES (${payload.sub}, ${category}, ${consented ? 1 : 0}, 'settings', '1.0')
          ON DUPLICATE KEY UPDATE consented = ${consented ? 1 : 0}, source = 'settings', updated_at = NOW()`,
    );
  }

  return res.json({ ok: true, updated: updates.length });
}
