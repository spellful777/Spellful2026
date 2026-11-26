import { selectRows } from '@/server/db/select-rows';
// POST /api/groups/:id/invite — invite a user to a group
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

  const { inviteeId } = req.body as { inviteeId?: string };
  if (!inviteeId) { res.status(400).json({ error: 'inviteeId is required' }); return; }

  // Verify inviter is a member
  const [membership] = await db.execute(sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId} AND left_at IS NULL
  `);
  if (!(selectRows<unknown>(membership)).length) { res.status(403).json({ error: 'Not a member of this group' }); return; }

  // Check invitee's group invite permission
  const [privacyRows] = await db.execute(sql`
    SELECT group_invite_permission FROM messaging_privacy_settings WHERE user_id = ${inviteeId}
  `);
  const invitePermission = (selectRows<{ group_invite_permission: string }>(privacyRows))[0]?.group_invite_permission ?? 'everyone';

  if (invitePermission === 'nobody') {
    res.status(403).json({ error: 'This member does not accept group invitations' }); return;
  }

  if (invitePermission === 'connections') {
    const [conn] = await db.execute(sql`
      SELECT 1 FROM coven_connections
      WHERE status = 'accepted'
        AND ((requester_id = ${userId} AND receiver_id = ${inviteeId})
          OR (requester_id = ${inviteeId} AND receiver_id = ${userId}))
    `);
    if (!(selectRows<unknown>(conn)).length) {
      res.status(403).json({ error: 'This member only accepts group invitations from connections' }); return;
    }
  }

  // Check blocks
  const [blocks] = await db.execute(sql`
    SELECT 1 FROM community_blocks
    WHERE (blocker_id = ${userId} AND blocked_id = ${inviteeId})
       OR (blocker_id = ${inviteeId} AND blocked_id = ${userId})
    LIMIT 1
  `);
  if ((selectRows<unknown>(blocks)).length) {
    res.status(403).json({ error: 'Cannot invite this member' }); return;
  }

  // Check if already a member
  const [alreadyMember] = await db.execute(sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${inviteeId} AND left_at IS NULL
  `);
  if ((selectRows<unknown>(alreadyMember)).length) {
    res.status(409).json({ error: 'User is already a member' }); return;
  }

  // Check member limit
  const [countRows] = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM group_members WHERE group_id = ${groupId} AND left_at IS NULL
  `);
  if (Number((selectRows<{ cnt: number }>(countRows))[0]?.cnt ?? 0) >= 50) {
    res.status(400).json({ error: 'Group is at maximum capacity (50 members)' }); return;
  }

  await db.execute(sql`
    INSERT INTO group_invitations (group_id, inviter_id, invitee_id)
    VALUES (${groupId}, ${userId}, ${inviteeId})
    ON DUPLICATE KEY UPDATE status = 'pending', updated_at = NOW()
  `);

  res.status(201).json({ ok: true });
}
