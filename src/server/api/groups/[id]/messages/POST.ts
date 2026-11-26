import { selectRows } from '@/server/db/select-rows';
// POST /api/groups/:id/messages — send a message to a group
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { sendPushToUser } from '@/server/lib/push-notify.js';
import { fanoutToUser } from '@/server/lib/sse-registry.js';

export default async function handler(req: Request<{ id: string }>, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: 'Invalid group id' }); return; }

  const { content, replyToId, idempotencyKey } = req.body as {
    content?: string;
    replyToId?: number;
    idempotencyKey?: string;
  };

  if (!content?.trim()) { res.status(400).json({ error: 'Message content is required' }); return; }
  if (content.length > 4000) { res.status(400).json({ error: 'Message too long' }); return; }

  // Verify active membership
  const [membership] = await db.execute(sql`
    SELECT 1 FROM group_members WHERE group_id = ${groupId} AND user_id = ${userId} AND left_at IS NULL
  `);
  if (!(selectRows<unknown>(membership)).length) { res.status(403).json({ error: 'Not a member of this group' }); return; }

  // Idempotency check
  if (idempotencyKey) {
    const [existing] = await db.execute(sql`
      SELECT id FROM group_messages WHERE group_id = ${groupId} AND idempotency_key = ${idempotencyKey}
    `);
    const existingRows = selectRows<{ id: number }>(existing);
    if (existingRows.length) {
      res.status(200).json({ messageId: existingRows[0].id, duplicate: true }); return;
    }
  }

  const [result] = await db.execute(sql`
    INSERT INTO group_messages (group_id, sender_id, content, reply_to_id, idempotency_key)
    VALUES (${groupId}, ${userId}, ${content.trim()}, ${replyToId ?? null}, ${idempotencyKey ?? null})
  `);

  // Update group updated_at for inbox ordering
  await db.execute(sql`UPDATE group_conversations SET updated_at = NOW() WHERE id = ${groupId}`);

  // Clear draft for this group
  await db.execute(sql`DELETE FROM conversation_drafts WHERE user_id = ${userId} AND group_id = ${groupId}`);

  const newMsgId = (result as { insertId?: number }).insertId;

  // Push notifications + SSE fanout to all other group members
  const [memberRows] = await db.execute(sql`
    SELECT user_id FROM group_members
    WHERE group_id = ${groupId} AND user_id != ${userId} AND left_at IS NULL
  `);
  const memberIds = (selectRows<{ user_id: string }>(memberRows)).map(r => r.user_id);

  // Fetch sender name once
  const [senderRow] = await db.execute(sql`SELECT name, username FROM user WHERE id = ${userId} LIMIT 1`);
  const sender = (selectRows<{ name: string | null; username: string | null }>(senderRow))[0];
  const senderName = sender?.name ?? sender?.username ?? 'Someone';

  // Fetch group name once
  const [groupRow] = await db.execute(sql`SELECT name FROM group_conversations WHERE id = ${groupId} LIMIT 1`);
  const groupName = (selectRows<{ name: string }>(groupRow))[0]?.name ?? 'Group';

  for (const memberId of memberIds) {
    // SSE real-time fanout
    fanoutToUser(memberId, {
      type: 'group_message',
      payload: { groupId, senderId: userId, messageId: newMsgId },
    });
    // Push notification (fire-and-forget)
    void sendPushToUser(memberId, {
      title: groupName,
      body: `${senderName}: New message`,
      url: '/messages',
    });
  }
  // Notify sender's other tabs
  fanoutToUser(userId, {
    type: 'group_message',
    payload: { groupId, senderId: userId, messageId: newMsgId, isMine: true },
  });

  res.status(201).json({ messageId: newMsgId });
}
