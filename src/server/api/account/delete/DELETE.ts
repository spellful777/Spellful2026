/**
 * DELETE /api/account/delete
 * Cancels a pending account deletion request.
 * Writes an audit event on success.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { writeAuditEvent } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const userId = session.user.id as string;

  await db.update(user).set({ deletionRequestedAt: null }).where(eq(user.id, userId));

  await writeAuditEvent({
    actorId: userId,
    targetId: userId,
    action: 'account.deletion_cancelled',
    oldValue: 'deletion_scheduled',
    newValue: 'active',
    reason: 'member_cancelled',
    ipAddress: req.ip ?? '',
  });

  res.json({ ok: true });
}
