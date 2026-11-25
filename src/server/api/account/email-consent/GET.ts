/**
 * GET /api/account/email-consent
 * Returns the authenticated user's marketing consent state.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { MARKETING_CATEGORIES } from '../../../api/email-preferences/GET.js';

interface ConsentRow { category: string; consented: boolean }

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const [rows] = await db.execute<ConsentRow>(
    sql`SELECT category, consented FROM marketing_consent WHERE user_id = ${session.user.id}`,
  );

  const consentMap: Record<string, boolean> = {};
  for (const row of rows as ConsentRow[]) {
    consentMap[row.category] = Boolean(row.consented);
  }

  const categories = MARKETING_CATEGORIES.map(c => ({
    ...c,
    consented: consentMap[c.id] ?? false,
  }));

  return res.json({ categories });
}
