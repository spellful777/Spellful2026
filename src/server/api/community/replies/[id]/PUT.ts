import { SPARK_COMMENT_LIMIT } from '@/lib/spark-comments';
import { countSparkCharacters, sparkBodyHtml } from '@/lib/sparks';
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityPosts, communityReplies } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const replyId = parseInt(req.params.id);
  if (isNaN(replyId)) return res.status(400).json({ error: 'Invalid id' });

  const [reply] = await db.select({ userId: communityReplies.userId, type: communityPosts.type, gifUrl: communityReplies.gifUrl }).from(communityReplies).innerJoin(communityPosts, eq(communityPosts.id, communityReplies.postId)).where(eq(communityReplies.id, replyId)).limit(1);
  if (!reply) return res.status(404).json({ error: 'Reply not found' });
  if (reply.userId !== session.user.id) return res.status(403).json({ error: 'Not your reply' });

  const { body } = req.body as { body?: string };
  if (typeof body !== 'string' || (!body.trim() && !reply.gifUrl)) return res.status(400).json({ error: 'body is required' });

  if (reply.type === 'spark' && countSparkCharacters(body) > SPARK_COMMENT_LIMIT)
    return res.status(400).json({ error: 'Comments can be up to 280 characters.' });
  const saved = reply.type === 'spark' ? sparkBodyHtml(body.trim()) : body.trim();
  await db.update(communityReplies).set({ body: saved }).where(eq(communityReplies.id, replyId));
  res.json({ ok: true, body: saved });
}
