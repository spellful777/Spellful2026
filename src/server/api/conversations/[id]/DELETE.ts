/** Delete the shared thread from the requesting participant's inbox only. */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { conversations } from '@/server/db/schema.js';
import { eq, and, or, sql } from 'drizzle-orm';

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

  await db.execute(sql`
    INSERT INTO conversation_user_state (user_id, conversation_id, is_hidden, cleared_through_message_id)
    SELECT ${myId}, ${convId}, 1, COALESCE(MAX(id), 0)
    FROM messages WHERE conversation_id = ${convId}
    ON DUPLICATE KEY UPDATE
      is_hidden = 1,
      is_archived = 0,
      is_pinned = 0,
      cleared_through_message_id = GREATEST(cleared_through_message_id, VALUES(cleared_through_message_id))
  `);

  res.json({ ok: true });
}
