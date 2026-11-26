import type { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPostFollowers, communityPosts } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { visiblePostForMember } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to follow a conversation' });
  const userId = session.user.id;
  const postId = Number(req.params.id);
  const following: unknown = req.body?.following;
  if (!Number.isSafeInteger(postId) || postId < 1 || typeof following !== 'boolean') {
    return res.status(400).json({ error: 'Invalid conversation or follow state' });
  }

  if (following) {
    const [post] = await db.select({ id: communityPosts.id }).from(communityPosts)
      .where(visiblePostForMember(postId, userId)).limit(1);
    if (!post) return res.status(404).json({ error: 'Conversation unavailable' });

    await db.insert(communityPostFollowers).values({ postId, userId })
      .onDuplicateKeyUpdate({ set: { userId } });
  } else {
    await db.delete(communityPostFollowers)
      .where(and(eq(communityPostFollowers.postId, postId), eq(communityPostFollowers.userId, userId)));
  }
  res.json({ following });
}
