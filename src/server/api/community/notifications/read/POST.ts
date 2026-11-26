import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityNotifications, communityPosts, communityReplies } from '@/server/db/schema.js';
import { eq, and, inArray, lte, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { ids, conversationPostId, throughId } = req.body as { ids?: number[]; conversationPostId?: number; throughId?: number };
  if (conversationPostId !== undefined || throughId !== undefined) {
    if (!Number.isSafeInteger(conversationPostId) || !Number.isSafeInteger(throughId) || conversationPostId! < 1 || throughId! < 1)
      return res.status(400).json({ error: 'Invalid conversation' });
    const viewer = session.user.id;
    await db.update(communityNotifications).set({ isRead: true }).where(and(
      eq(communityNotifications.userId, viewer), eq(communityNotifications.postId, conversationPostId!),
      eq(communityNotifications.type, 'reply'), lte(communityNotifications.id, throughId!),
      sql`exists (select 1 from ${communityPosts} where ${communityPosts.id} = ${conversationPostId}
        and ${communityPosts.userId} = ${viewer} and ${communityPosts.type} = 'spark')`,
      sql`not exists (select 1 from ${communityReplies} child inner join ${communityReplies} parent on parent.id = child.parent_id
        where child.id = ${communityNotifications.replyId} and parent.user_id = ${viewer})`,
    ));
    return res.json({ ok: true });
  }
  if (ids !== undefined && (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => !Number.isSafeInteger(id) || id < 1)))
    return res.status(400).json({ error: 'Invalid notification ids' });

  if (ids?.length) {
    await db.update(communityNotifications).set({ isRead: true })
      .where(and(eq(communityNotifications.userId, session.user.id), inArray(communityNotifications.id, ids)));
  } else {
    // Mark all as read
    await db.update(communityNotifications).set({ isRead: true }).where(eq(communityNotifications.userId, session.user.id));
  }

  res.json({ ok: true });
}
