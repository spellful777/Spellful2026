import { selectRows } from '@/server/db/select-rows';
// POST /api/groups — create a new group conversation
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;

  const { name, description, memberIds, historyPolicy } = req.body as {
    name?: string;
    description?: string;
    memberIds?: string[];
    historyPolicy?: string;
  };

  if (!name?.trim()) { res.status(400).json({ error: 'Group name is required' }); return; }
  if (!Array.isArray(memberIds) || memberIds.length === 0) {
    res.status(400).json({ error: 'At least one member is required' }); return;
  }
  if (memberIds.length > 49) {
    res.status(400).json({ error: 'Groups are limited to 50 members' }); return;
  }

  const allMemberIds = [...new Set(memberIds.filter(id => id !== userId))];

  // Check blocks
  if (allMemberIds.length > 0) {
    for (const memberId of allMemberIds) {
      const [blocks] = await db.execute(sql`
        SELECT 1 FROM community_blocks
        WHERE (blocker_id = ${userId} AND blocked_id = ${memberId})
           OR (blocked_id = ${userId} AND blocker_id = ${memberId})
        LIMIT 1
      `);
      if ((selectRows<unknown>(blocks)).length > 0) {
        res.status(403).json({ error: 'Cannot create group with a blocked member' }); return;
      }
    }
  }

  // Create the group
  const [result] = await db.execute(sql`
    INSERT INTO group_conversations (name, description, created_by, history_policy)
    VALUES (${name.trim()}, ${description?.trim() ?? ''}, ${userId}, ${historyPolicy ?? 'from_join'})
  `);
  const groupId = (result as { insertId?: number }).insertId;
  if (!groupId) { res.status(500).json({ error: 'Failed to create group' }); return; }

  // Add creator as admin
  await db.execute(sql`
    INSERT INTO group_members (group_id, user_id, role) VALUES (${groupId}, ${userId}, 'admin')
  `);

  // Add other members
  for (const memberId of allMemberIds) {
    await db.execute(sql`
      INSERT IGNORE INTO group_members (group_id, user_id, role) VALUES (${groupId}, ${memberId}, 'member')
    `);
  }

  // Post a system message
  await db.execute(sql`
    INSERT INTO group_messages (group_id, sender_id, content, system_message)
    VALUES (${groupId}, ${userId}, '', 'Group created')
  `);

  res.status(201).json({ groupId, name: name.trim() });
}
