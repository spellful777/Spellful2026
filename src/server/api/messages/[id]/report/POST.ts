import { selectRows } from '@/server/db/select-rows';
/**
 * POST /api/messages/:id/report
 * Report a specific message for abuse/harassment.
 * Rate-limited to 10 reports per user per hour (enforced in entry.ts).
 * Deduplicates: one report per (reporter, message).
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

const VALID_REASONS = ['harassment', 'hate_speech', 'spam', 'threats', 'sexual_content', 'misinformation', 'other'];

export default async function handler(req: Request<{ id: string }>, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const reporterId = session.user.id;
  const messageId = parseInt(req.params.id, 10);
  if (isNaN(messageId)) { res.status(400).json({ error: 'Invalid message id' }); return; }

  const { reason, details } = req.body as { reason?: string; details?: string };
  if (!reason || !VALID_REASONS.includes(reason)) {
    res.status(400).json({ error: 'Invalid reason', validReasons: VALID_REASONS }); return;
  }

  // Verify the message exists and the reporter is a participant in the conversation
  const [msgRows] = await db.execute(sql`
    SELECT m.id, m.conversation_id, m.sender_id, c.participant1_id, c.participant2_id
    FROM messages m
    INNER JOIN conversations c ON c.id = m.conversation_id
    WHERE m.id = ${messageId}
    LIMIT 1
  `);
  const msgs = selectRows<{ id: number; conversation_id: number; sender_id: string; participant1_id: string; participant2_id: string }>(msgRows);
  if (!msgs.length) { res.status(404).json({ error: 'Message not found' }); return; }
  const msg = msgs[0];
  if (msg.participant1_id !== reporterId && msg.participant2_id !== reporterId) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }
  // Can't report your own message
  if (msg.sender_id === reporterId) {
    res.status(400).json({ error: 'Cannot report your own message' }); return;
  }

  // Deduplicate — one report per (reporter, message)
  const [existing] = await db.execute(sql`
    SELECT id FROM message_reports
    WHERE reporter_id = ${reporterId} AND message_id = ${messageId}
    LIMIT 1
  `);
  if ((selectRows<unknown>(existing)).length > 0) {
    res.status(200).json({ ok: true, duplicate: true }); return;
  }

  await db.execute(sql`
    INSERT INTO message_reports (message_id, conversation_id, reporter_id, reported_user_id, reason, details)
    VALUES (${messageId}, ${msg.conversation_id}, ${reporterId}, ${msg.sender_id}, ${reason}, ${details?.slice(0, 500) ?? null})
  `);

  res.status(201).json({ ok: true });
}
