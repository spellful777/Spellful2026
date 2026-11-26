import { selectRows } from '@/server/db/select-rows';
// GET /api/groups/:id/members — list members of a group
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

  // Verify requester is a member
  const [membership] = await db.execute(sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId} AND left_at IS NULL
  `);
  if (!(selectRows<unknown>(membership)).length) { res.status(403).json({ error: 'Not a member of this group' }); return; }

  const [rows] = await db.execute(sql`
    SELECT
      gm.user_id AS userId,
      gm.role,
      gm.joined_at AS joinedAt,
      u.name,
      u.username,
      u.image
    FROM group_members gm
    INNER JOIN user u ON u.id = gm.user_id
    WHERE gm.group_id = ${groupId} AND gm.left_at IS NULL
    ORDER BY gm.role DESC, gm.joined_at ASC
  `);

  res.json({ members: rows });
}
