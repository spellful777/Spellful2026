import { selectRows } from '@/server/db/select-rows';
// GET /api/groups/invitations — list pending group invitations for the current user
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;

  const [rows] = await db.execute(sql`
    SELECT
      gi.id,
      gi.group_id AS groupId,
      gi.inviter_id AS inviterId,
      gi.created_at AS createdAt,
      gc.name AS groupName,
      gc.description AS groupDescription,
      gc.avatar_url AS groupAvatarUrl,
      u.name AS inviterName,
      u.username AS inviterUsername,
      u.image AS inviterImage,
      (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = gc.id AND gm.left_at IS NULL) AS memberCount
    FROM group_invitations gi
    INNER JOIN group_conversations gc ON gc.id = gi.group_id
    INNER JOIN user u ON u.id = gi.inviter_id
    WHERE gi.invitee_id = ${userId} AND gi.status = 'pending'
    ORDER BY gi.created_at DESC
  `);

  // MySQL lowercases all column alias names returned by db.execute().
  // Map lowercase keys → camelCase so the frontend receives the expected shape.
  const invitations = (selectRows<Record<string, unknown>>(rows)).map(r => ({
    id: r.id,
    groupId: r.groupid ?? r.groupId,
    inviterId: r.inviterid ?? r.inviterId,
    createdAt: r.createdat ?? r.createdAt,
    groupName: r.groupname ?? r.groupName ?? null,
    groupDescription: r.groupdescription ?? r.groupDescription ?? null,
    groupAvatarUrl: r.groupavatarurl ?? r.groupAvatarUrl ?? null,
    inviterName: r.invitername ?? r.inviterName ?? null,
    inviterUsername: r.inviterusername ?? r.inviterUsername ?? null,
    inviterImage: r.inviterimage ?? r.inviterImage ?? null,
    memberCount: Number(r.membercount ?? r.memberCount ?? 0),
  }));

  res.json({ invitations });
}
