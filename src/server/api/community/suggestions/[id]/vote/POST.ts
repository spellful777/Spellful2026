/**
 * POST /api/community/suggestions/:id/vote
 * Toggle upvote on a suggestion.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communitySuggestions, communitySuggestionVotes } from '@/server/db/schema.js';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const [existing] = await db
    .select({ id: communitySuggestionVotes.id })
    .from(communitySuggestionVotes)
    .where(and(
      eq(communitySuggestionVotes.suggestionId, id),
      eq(communitySuggestionVotes.userId, session.user.id),
    ))
    .limit(1);

  if (existing) {
    // Remove vote
    await db.delete(communitySuggestionVotes).where(eq(communitySuggestionVotes.id, existing.id));
    await db.update(communitySuggestions)
      .set({ voteCount: sql`GREATEST(vote_count - 1, 0)` })
      .where(eq(communitySuggestions.id, id));
    return res.json({ voted: false });
  } else {
    // Add vote
    await db.insert(communitySuggestionVotes).values({ suggestionId: id, userId: session.user.id });
    await db.update(communitySuggestions)
      .set({ voteCount: sql`vote_count + 1` })
      .where(eq(communitySuggestions.id, id));
    return res.json({ voted: true });
  }
}
