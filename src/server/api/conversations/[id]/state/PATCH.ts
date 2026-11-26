import clearConversation from '../DELETE.js';
/**
 * PATCH /api/conversations/:id/state
 * Upserts per-user conversation state: archive, pin, mute, star, hidden (delete-for-me).
 * Body: { isArchived?, isPinned?, isMuted?, isStarred?, isHidden? }
 * Only the fields provided are updated; others are left unchanged.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { conversations, conversationUserState } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  if (req.body?.clearHistory === true) return clearConversation(req, res);
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const myId = session.user.id;
  const convId = parseInt(req.params.id);
  if (isNaN(convId)) return res.status(400).json({ error: 'Invalid id' });

  // Verify participant
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId)).limit(1);
  if (!conv) return res.status(404).json({ error: 'Not found' });
  if (conv.participant1Id !== myId && conv.participant2Id !== myId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const body = req.body as {
    isArchived?: boolean;
    isPinned?: boolean;
    isMuted?: boolean;
    isStarred?: boolean;
    isHidden?: boolean;
  };

  // Build only the fields that were explicitly provided
  const updates: Record<string, boolean> = {};
  if (typeof body.isArchived === 'boolean') updates.isArchived = body.isArchived;
  if (typeof body.isPinned === 'boolean') updates.isPinned = body.isPinned;
  if (typeof body.isMuted === 'boolean') updates.isMuted = body.isMuted;
  if (typeof body.isStarred === 'boolean') updates.isStarred = body.isStarred;
  if (typeof body.isHidden === 'boolean') updates.isHidden = body.isHidden;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No state fields provided' });
  }

  // Check if a row already exists
  const [existing] = await db
    .select({ id: conversationUserState.id })
    .from(conversationUserState)
    .where(and(
      eq(conversationUserState.userId, myId),
      eq(conversationUserState.conversationId, convId),
    ))
    .limit(1);

  if (existing) {
    await db
      .update(conversationUserState)
      .set(updates)
      .where(and(
        eq(conversationUserState.userId, myId),
        eq(conversationUserState.conversationId, convId),
      ));
  } else {
    await db.insert(conversationUserState).values({
      userId: myId,
      conversationId: convId,
      isArchived: updates.isArchived ?? false,
      isPinned: updates.isPinned ?? false,
      isMuted: updates.isMuted ?? false,
      isStarred: updates.isStarred ?? false,
      isHidden: updates.isHidden ?? false,
    });
  }

  // Return the full current state
  const [state] = await db
    .select()
    .from(conversationUserState)
    .where(and(
      eq(conversationUserState.userId, myId),
      eq(conversationUserState.conversationId, convId),
    ))
    .limit(1);

  res.json({ ok: true, state });
}
