/**
 * GET /api/message-requests
 * Returns pending message requests for the current user.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { messageRequests, messages, user } from '@/server/db/schema.js';
import { eq, and, desc, sql } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const myId = session.user.id;

  const rows = await db
    .select({
      id: messageRequests.id,
      conversationId: messageRequests.conversationId,
      requesterId: messageRequests.requesterId,
      status: messageRequests.status,
      createdAt: messageRequests.createdAt,
      requesterName: user.name,
      requesterUsername: user.username,
      requesterImage: user.image,
      latest: { ciphertext: messages.ciphertext, iv: messages.iv, createdAt: messages.createdAt },
    })
    .from(messageRequests)
    .leftJoin(user, eq(messageRequests.requesterId, user.id))
    .leftJoin(messages, eq(messages.id, sql`(
      SELECT MAX(id) FROM messages
      WHERE conversation_id = ${messageRequests.conversationId} AND status = 'sent'
    )`))
    .where(and(eq(messageRequests.recipientId, myId), eq(messageRequests.status, 'pending')))
    .orderBy(desc(messageRequests.createdAt));

  res.json({ requests: rows });
}
