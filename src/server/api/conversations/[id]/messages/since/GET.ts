/**
 * GET /api/conversations/:id/messages/since
 * Returns messages created after ?after=<ISO timestamp>.
 * Also marks incoming messages as delivered (deliveredAt) and read (readAt)
 * when the recipient is actively polling this thread.
 * Used for lightweight polling to detect new messages.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { conversations, messages } from '@/server/db/schema.js';
import { eq, and, gte, sql } from 'drizzle-orm';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const myId = session.user.id;
  const convId = parseInt(req.params.id);
  if (isNaN(convId)) return res.status(400).json({ error: 'Invalid id' });

  const afterParam = (req.query as Record<string, string>).after;
  const afterDate = afterParam ? new Date(afterParam) : new Date(0);
  if (isNaN(afterDate.getTime())) return res.status(400).json({ error: 'Invalid after timestamp' });

  // Verify participant
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  if (conv.participant1Id !== myId && conv.participant2Id !== myId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Mark incoming messages as delivered (first time recipient polls) and read
  // (recipient is actively viewing this thread while polling).
  await db.execute(sql`
    UPDATE messages
    SET
      delivered_at = COALESCE(delivered_at, NOW()),
      read_at      = COALESCE(read_at, NOW())
    WHERE conversation_id = ${convId}
      AND sender_id != ${myId}
      AND status = 'sent'
      AND read_at IS NULL
  `);

  // Use gte (>=) instead of gt (>) because MySQL TIMESTAMP has 1-second precision:
  // a message stored at the same second as the last-seen timestamp would be
  // excluded by strict gt. The client deduplicates by message ID so re-fetching
  // the boundary message is harmless.
  // Status values in schema: sent | draft | trashed — filter to 'sent' only.
  const newMsgs = await db
    .select()
    .from(messages)
    .where(and(
      eq(messages.conversationId, convId),
      eq(messages.status, 'sent'),
      gte(messages.createdAt, afterDate),
    ));

  res.json(newMsgs.map(m => ({ ...m, systemMessage: m.systemMessage ?? null })));
}
