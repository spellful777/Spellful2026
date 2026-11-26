/**
 * PATCH /api/admin/community/suggestions/:id
 * Update suggestion status and staff response. Requires admin role.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communitySuggestions } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

const VALID_STATUSES = ['open', 'planned', 'in-progress', 'shipped', 'declined'];

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const { status, staffResponse } = req.body as { status?: string; staffResponse?: string };
  if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const updates: Record<string, unknown> = {};
  if (status) updates.status = status;
  if (staffResponse !== undefined) {
    updates.staffResponse = staffResponse;
    updates.staffResponseBy = session.user.id;
    updates.staffResponseAt = new Date();
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  await db.update(communitySuggestions).set(updates).where(eq(communitySuggestions.id, id));
  return res.json({ ok: true });
}
