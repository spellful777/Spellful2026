import { selectRows } from '@/server/db/select-rows';
/**
 * POST /api/conversations/:id/messages
 * Send an encrypted message.
 * Body: { ciphertext: string, iv: string, status?: 'sent'|'draft', replyToId?: number, idempotencyKey?: string }
 *
 * Idempotency: if idempotencyKey is provided and a message with the same key already
 * exists in this conversation from this sender, the existing message is returned (201)
 * without inserting a duplicate. This prevents double-sends on network retry.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { conversations, messageRequests, messages, user } from '@/server/db/schema.js';
import { and, eq, sql } from 'drizzle-orm';
import { sendPushToUser } from '@/server/lib/push-notify.js';
import { fanoutToUser } from '@/server/lib/sse-registry.js';
import { isBlocked } from '@/server/lib/block-check.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const myId = session.user.id;
  const convId = parseInt(req.params.id);
  if (isNaN(convId)) return res.status(400).json({ error: 'Invalid id' });

  const { ciphertext, iv, status, replyToId, idempotencyKey } = req.body as {
    ciphertext?: string;
    iv?: string;
    status?: string;
    replyToId?: number;
    idempotencyKey?: string;
  };
  if (!ciphertext || !iv) return res.status(400).json({ error: 'ciphertext and iv required' });
  const msgStatus = status === 'draft' ? 'draft' : 'sent';

  // Verify participant
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  if (conv.participant1Id !== myId && conv.participant2Id !== myId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Block check — silently accept the message on the sender's side but don't deliver it.
  // Fail closed: if DB is unavailable, return 503 rather than delivering to a potentially blocked user.
  const recipientId = conv.participant1Id === myId ? conv.participant2Id : conv.participant1Id;
  let blocked: boolean;
  try {
    blocked = recipientId ? await isBlocked(myId, recipientId) : false;
  } catch {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }
  if (blocked) {
    // Return a fake success so the sender's UI behaves normally
    return res.status(201).json({ id: -1, blocked: true });
  }

  // Privacy check — respect recipient's whoCanMessage setting
  let requireRequest = false;
  if (recipientId && msgStatus === 'sent') {
    const [privacyRows] = await db.execute(sql`
      SELECT who_can_message FROM messaging_privacy_settings WHERE user_id = ${recipientId} LIMIT 1
    `);
    const privRows = selectRows<{ who_can_message: string }>(privacyRows);
    const whoCanMessage = privRows[0]?.who_can_message ?? 'everyone';
    if (whoCanMessage === 'nobody') {
      return res.status(403).json({ error: 'This user is not accepting messages.' });
    }
    if (whoCanMessage === 'connections' || whoCanMessage === 'requests') {
      // Check if they are coven connections
      const [connRows] = await db.execute(sql`
        SELECT id FROM coven_connections
        WHERE status = 'accepted'
          AND ((requester_id = ${myId} AND receiver_id = ${recipientId})
            OR (requester_id = ${recipientId} AND receiver_id = ${myId}))
        LIMIT 1
      `);
      const connected = selectRows<unknown>(connRows).length > 0;
      requireRequest = !connected && whoCanMessage === 'requests';
      if (!connected && whoCanMessage === 'connections') {
        return res.status(403).json({ error: 'This user only accepts messages from connections.' });
      }
    }
    // 'requests' and 'everyone' allow the message through (request flow is handled by message_requests table)
  }

  // Idempotency check — if the client supplied a key, look for an existing message
  // with the same key in this conversation from this sender.
  if (idempotencyKey && idempotencyKey.length <= 128) {
    const existing = await db.execute(sql`
      SELECT id FROM messages
      WHERE conversation_id = ${convId}
        AND sender_id = ${myId}
        AND idempotency_key = ${idempotencyKey}
      LIMIT 1
    `);
    const rows = (existing as unknown as [Array<{ id: number }>, unknown])[0];
    if (rows.length > 0) {
      // Duplicate send — return the existing message id without inserting
      return res.status(201).json({ id: rows[0].id, duplicate: true });
    }
  }

  const insertId = await db.transaction(async tx => {
    await tx.select({ id: conversations.id }).from(conversations)
      .where(eq(conversations.id, convId)).for('update');
    if (msgStatus === 'sent' && recipientId) {
      const [request] = await tx.select().from(messageRequests)
        .where(eq(messageRequests.conversationId, convId)).limit(1);
      if (request?.status === 'declined' || (request?.status === 'pending' && request.recipientId === myId)) return null;
      if (!request && requireRequest) {
        const [previousMessage] = await tx.select({ id: messages.id }).from(messages)
          .where(and(eq(messages.conversationId, convId), eq(messages.status, 'sent'))).limit(1);
        if (!previousMessage) {
          await tx.insert(messageRequests).values({ conversationId: convId, requesterId: myId, recipientId });
        }
      }
    }
    // Insert the message. Use raw SQL to include optional columns added by migrations.
    const result = await tx.execute(sql`
      INSERT INTO messages (conversation_id, sender_id, ciphertext, iv, status, reply_to_id, idempotency_key)
      VALUES (${convId}, ${myId}, ${ciphertext}, ${iv}, ${msgStatus}, ${replyToId ?? null}, ${idempotencyKey ?? null})
    `);
    const messageId = (result as unknown as [{ insertId: number }])[0].insertId;

    if (msgStatus === 'sent') {
      await tx.execute(sql`
        UPDATE conversations c
        LEFT JOIN conversation_user_state s ON s.conversation_id = c.id AND (s.user_id = ${myId} OR s.user_id = ${recipientId}) AND s.cleared_through_message_id < ${messageId}
        SET c.updated_at = NOW(), s.is_hidden = 0, s.is_archived = IF(s.user_id = ${myId}, 0, s.is_archived)
        WHERE c.id = ${convId}
      `);
    }

    return messageId;
  });
  if (insertId === null) return res.status(403).json({ error: 'This message request must be accepted before you can reply.' });

  // Send push notification to the recipient (fire-and-forget, non-blocking)
  if (msgStatus === 'sent' && recipientId) {
    const [sender] = await db
      .select({ name: user.name, username: user.username })
      .from(user)
      .where(eq(user.id, myId))
      .limit(1);
    const senderName = sender?.name ?? sender?.username ?? 'Someone';
    void sendPushToUser(recipientId, {
      title: `New message from ${senderName}`,
      body: '✨ You have a new encrypted message on Spellful',
      url: '/messages',
    });
    // Real-time SSE fanout — push to all open tabs of the recipient
    fanoutToUser(recipientId, {
      type: 'new_message',
      payload: { conversationId: convId, senderId: myId, messageId: insertId },
    });
    // Also notify the sender's other tabs so they stay in sync
    fanoutToUser(myId, {
      type: 'new_message',
      payload: { conversationId: convId, senderId: myId, messageId: insertId, isMine: true },
    });
  }

  res.status(201).json({ id: insertId });
}
