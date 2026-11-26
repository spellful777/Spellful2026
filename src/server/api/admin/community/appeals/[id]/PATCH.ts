/**
 * PATCH /api/admin/community/appeals/:id
 * Resolve an appeal (accept or reject). Requires admin role.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityAppeals } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole, writeAuditEvent } from '@/server/lib/require-role.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const { status, adminNote } = req.body as { status?: string; adminNote?: string };
  if (!status || !['accepted', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be accepted or rejected' });
  }

  await db.update(communityAppeals).set({
    status,
    adminNote: adminNote ?? '',
    reviewedBy: session.user.id,
    reviewedAt: new Date(),
  }).where(eq(communityAppeals.id, id));

  await writeAuditEvent({
    actorId: session.user.id,
    action: 'appeal.resolve',
    targetId: String(id),
    newValue: status,
    reason: adminNote ?? '',
  });

  return res.json({ ok: true });
}
