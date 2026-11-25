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
import { conversations, user } from '@/server/db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { sendPushToUser } from '@/server/lib/push-notify.js';
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

  // Insert the message. Use raw SQL to include optional columns added by migrations.
  const result = await db.execute(sql`
    INSERT INTO messages (conversation_id, sender_id, ciphertext, iv, status, reply_to_id, idempotency_key)
    VALUES (${convId}, ${myId}, ${ciphertext}, ${iv}, ${msgStatus}, ${replyToId ?? null}, ${idempotencyKey ?? null})
  `);
  const insertId = (result as unknown as [{ insertId: number }])[0].insertId;

  // Bump conversation updatedAt
  await db.execute(sql`UPDATE conversations SET updated_at = NOW() WHERE id = ${convId}`);

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
  }

  res.status(201).json({ id: insertId });
}
