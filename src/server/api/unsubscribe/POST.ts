/**
 * POST /api/unsubscribe
 * One-click unsubscribe from all marketing emails.
 * Body: { token: string }
 * No login required.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { verifyMomentsToken } from '@/server/lib/moments-tokens.js';
import { MARKETING_CATEGORIES } from '../email-preferences/GET.js';

export default async function handler(req: Request, res: Response) {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: 'Missing token' });

  const payload = await verifyMomentsToken(token);
  if (!payload) return res.status(401).json({ error: 'Invalid or expired token' });

  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  // Opt out of all marketing categories
  for (const cat of MARKETING_CATEGORIES) {
    await db.execute(
      sql`INSERT INTO marketing_consent (user_id, category, consented, source, version)
          VALUES (${payload.sub}, ${cat.id}, 0, 'unsubscribe_link', '1.0')
          ON DUPLICATE KEY UPDATE consented = 0, source = 'unsubscribe_link', updated_at = NOW()`,
    );
  }

  return res.json({ ok: true });
}
