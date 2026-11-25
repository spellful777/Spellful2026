/**
 * GET /api/admin/command-center/messaging
 * Owner-only: DM thread overview + pending message requests.
 * Query: ?view=threads|requests&limit=25&offset=0
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { conversations, messageRequests } from '@/server/db/schema.js';
import { eq, desc, count, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const view   = typeof req.query.view   === 'string' ? req.query.view   : 'threads';
  const limit  = Math.min(Number(req.query.limit)  || 25, 100);
  const offset = Number(req.query.offset) || 0;

  if (view === 'requests') {
    // Pending message requests
    const [rows, [totalRow]] = await Promise.all([
      db.select({
        id:               messageRequests.id,
        status:           messageRequests.status,
        createdAt:        messageRequests.createdAt,
        requesterName:    sql`(SELECT name FROM user WHERE id = ${messageRequests.requesterId})`,
        requesterUsername: sql`(SELECT username FROM user WHERE id = ${messageRequests.requesterId})`,
        recipientName:    sql`(SELECT name FROM user WHERE id = ${messageRequests.recipientId})`,
        recipientUsername: sql`(SELECT username FROM user WHERE id = ${messageRequests.recipientId})`,
      })
        .from(messageRequests)
        .where(eq(messageRequests.status, 'pending'))
        .orderBy(desc(messageRequests.createdAt))
        .limit(limit + 1)
        .offset(offset),

      db.select({ n: count() })
        .from(messageRequests)
        .where(eq(messageRequests.status, 'pending')),
    ]);

    return res.json({
      requests: rows.slice(0, limit),
      hasMore: rows.length > limit,
      total: Number(totalRow?.n ?? 0),
    });
  }

  // Default: conversation threads with message count + last activity
  const [rows, [totalRow]] = await Promise.all([
    db.select({
      id:                conversations.id,
      createdAt:         conversations.createdAt,
      updatedAt:         conversations.updatedAt,
      participant1Name:  sql`(SELECT name FROM user WHERE id = ${conversations.participant1Id})`,
      participant1Username: sql`(SELECT username FROM user WHERE id = ${conversations.participant1Id})`,
      participant2Name:  sql`(SELECT name FROM user WHERE id = ${conversations.participant2Id})`,
      participant2Username: sql`(SELECT username FROM user WHERE id = ${conversations.participant2Id})`,
      messageCount:      sql`(SELECT COUNT(*) FROM messages WHERE conversation_id = ${conversations.id})`,
    })
      .from(conversations)
      .orderBy(desc(conversations.updatedAt))
      .limit(limit + 1)
      .offset(offset),

    db.select({ n: count() }).from(conversations),
  ]);

  return res.json({
    threads: rows.slice(0, limit),
    hasMore: rows.length > limit,
    total: Number(totalRow?.n ?? 0),
  });
}
