import { selectRows } from '@/server/db/select-rows';
// POST /api/groups/invitations/:id/decline — decline a group invitation
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request<{ id: string }>, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;
  const invitationId = parseInt(req.params.id, 10);
  if (isNaN(invitationId)) { res.status(400).json({ error: 'Invalid invitation id' }); return; }

  const [rows] = await db.execute(sql`
    SELECT 1 FROM group_invitations WHERE id = ${invitationId} AND invitee_id = ${userId} AND status = 'pending'
  `);
  if (!(selectRows<unknown>(rows)).length) { res.status(404).json({ error: 'Invitation not found' }); return; }

  await db.execute(sql`
    UPDATE group_invitations SET status = 'declined', updated_at = NOW() WHERE id = ${invitationId}
  `);

  res.json({ ok: true });
}
