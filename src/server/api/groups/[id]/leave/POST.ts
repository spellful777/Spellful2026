import { selectRows } from '@/server/db/select-rows';
// POST /api/groups/:id/leave — leave a group conversation
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request<{ id: string }>, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: 'Invalid group id' }); return; }

  const [membership] = await db.execute(sql`
    SELECT role FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId} AND left_at IS NULL
  `);
  const memberRows = selectRows<{ role: string }>(membership);
  if (!memberRows.length) { res.status(404).json({ error: 'Not a member of this group' }); return; }

  // If last admin, promote another member
  if (memberRows[0].role === 'admin') {
    const [otherAdmins] = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM group_members
      WHERE group_id = ${groupId} AND role = 'admin' AND user_id != ${userId} AND left_at IS NULL
    `);
    if (Number((selectRows<{ cnt: number }>(otherAdmins))[0]?.cnt ?? 0) === 0) {
      const [nextMember] = await db.execute(sql`
        SELECT user_id FROM group_members
        WHERE group_id = ${groupId} AND user_id != ${userId} AND left_at IS NULL
        ORDER BY joined_at ASC LIMIT 1
      `);
      const nextRows = selectRows<{ user_id: string }>(nextMember);
      if (nextRows.length) {
        await db.execute(sql`
          UPDATE group_members SET role = 'admin' WHERE group_id = ${groupId} AND user_id = ${nextRows[0].user_id}
        `);
      }
    }
  }

  await db.execute(sql`
    UPDATE group_members SET left_at = NOW() WHERE group_id = ${groupId} AND user_id = ${userId}
  `);

  await db.execute(sql`
    INSERT INTO group_messages (group_id, sender_id, content, system_message)
    VALUES (${groupId}, ${userId}, '', 'A member left the group')
  `);

  res.json({ ok: true });
}
