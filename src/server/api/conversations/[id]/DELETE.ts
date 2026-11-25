/**
 * DELETE /api/conversations/:id
 * Soft-deletes a conversation for the requesting participant.
 * Both participants can independently delete; when both have deleted it is
 * physically removed by a future cleanup job. For now we hard-delete immediately
 * since there is no per-participant soft-delete column — the conversation and all
 * its messages are removed (messages cascade via FK).
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { conversations } from '@/server/db/schema.js';
import { eq, and, or } from 'drizzle-orm';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const myId = session.user.id;

  const convId = parseInt(req.params.id);
  if (isNaN(convId)) return res.status(400).json({ error: 'Invalid id' });

  // Verify the requester is a participant
  const [conv] = await db
    .select({ id: conversations.id, p1: conversations.participant1Id, p2: conversations.participant2Id })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, convId),
        or(eq(conversations.participant1Id, myId), eq(conversations.participant2Id, myId)),
      ),
    )
    .limit(1);

  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  // Hard-delete — messages cascade via FK
  await db.delete(conversations).where(eq(conversations.id, convId));

  res.json({ ok: true });
}
