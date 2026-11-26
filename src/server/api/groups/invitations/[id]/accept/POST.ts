import { selectRows } from '@/server/db/select-rows';
// POST /api/groups/invitations/:id/accept — accept a group invitation
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
    SELECT group_id FROM group_invitations WHERE id = ${invitationId} AND invitee_id = ${userId} AND status = 'pending'
  `);
  const invRows = selectRows<{ group_id: number }>(rows);
  if (!invRows.length) { res.status(404).json({ error: 'Invitation not found' }); return; }

  const groupId = invRows[0].group_id;

  // Check member limit
  const [countRows] = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM group_members WHERE group_id = ${groupId} AND left_at IS NULL
  `);
  if (Number((selectRows<{ cnt: number }>(countRows))[0]?.cnt ?? 0) >= 50) {
    res.status(400).json({ error: 'Group is at maximum capacity' }); return;
  }

  await db.execute(sql`
    UPDATE group_invitations SET status = 'accepted', updated_at = NOW() WHERE id = ${invitationId}
  `);

  await db.execute(sql`
    INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (${groupId}, ${userId}, 'member')
  `);

  await db.execute(sql`
    INSERT INTO group_messages (group_id, sender_id, content, system_message)
    VALUES (${groupId}, ${userId}, '', 'A new member joined the group')
  `);

  await db.execute(sql`UPDATE group_conversations SET updated_at = NOW() WHERE id = ${groupId}`);

  res.json({ ok: true, groupId });
}
