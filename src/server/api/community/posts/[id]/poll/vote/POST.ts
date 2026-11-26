import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityPolls, communityPollVotes, communityPosts } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

import { visiblePostForMember } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const postId = Number(req.params.id);
  if (!Number.isSafeInteger(postId) || postId < 1) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  const { choiceIndex } = req.body as { choiceIndex?: number };
  if (typeof choiceIndex !== 'number' || !Number.isSafeInteger(choiceIndex) || choiceIndex < 0) {
    return res.status(400).json({ error: 'Invalid choice' });
  }

  const viewer = session.user.id;
  const result = await db.transaction(async (tx) => {
    const [poll] = await tx.select({
      id: communityPolls.id,
      choices: communityPolls.choices,
      isClosed: communityPolls.isClosed,
      closesAt: communityPolls.closesAt,
    }).from(communityPolls)
      .innerJoin(communityPosts, eq(communityPosts.id, communityPolls.postId))
      .where(visiblePostForMember(postId, viewer)).limit(1).for('update');
    if (!poll) return { status: 404, error: 'No poll on this post' };
    if (poll.isClosed || (poll.closesAt && poll.closesAt.getTime() <= Date.now())) {
      return { status: 400, error: 'Poll is closed' };
    }
    if (choiceIndex >= poll.choices.length) return { status: 400, error: 'Invalid choice' };

    const [existing] = await tx.select({ id: communityPollVotes.id }).from(communityPollVotes)
      .where(and(eq(communityPollVotes.pollId, poll.id), eq(communityPollVotes.userId, viewer))).limit(1);
    if (existing) return { status: 409, error: 'Already voted' };

    await tx.insert(communityPollVotes).values({ pollId: poll.id, userId: viewer, choiceIndex });
    return { status: 200 };
  });

  return res.status(result.status).json(result.error ? { error: result.error } : { ok: true });
}
