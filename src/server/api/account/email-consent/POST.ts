/**
 * POST /api/account/email-consent
 * Saves marketing consent for the authenticated user.
 * Body: { categories: Record<string, boolean>; source?: string }
 * Used by signup flow and account settings.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { MARKETING_CATEGORIES } from '../../../api/email-preferences/GET.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const { categories, source } = req.body as {
    categories?: Record<string, boolean>;
    source?: string;
  };
  if (!categories || typeof categories !== 'object') {
    return res.status(400).json({ error: 'Missing categories' });
  }

  const validSource = ['signup', 'settings'].includes(source ?? '') ? source : 'settings';
  const validIds = new Set(MARKETING_CATEGORIES.map(c => c.id));
  let updated = 0;

  for (const [cat, val] of Object.entries(categories)) {
    if (validIds.has(cat)) {
      await db.execute(
        sql`INSERT INTO marketing_consent (user_id, category, consented, source, version)
            VALUES (${session.user.id}, ${cat}, ${val ? 1 : 0}, ${validSource}, '1.0')
            ON DUPLICATE KEY UPDATE consented = ${val ? 1 : 0}, source = ${validSource}, updated_at = NOW()`,
      );
      updated++;
    }
  }

  return res.json({ ok: true, updated });
}
