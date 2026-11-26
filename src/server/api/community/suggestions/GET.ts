/**
 * GET /api/community/suggestions
 * Returns feature suggestions with vote counts.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communitySuggestions, communitySuggestionVotes, user } from '@/server/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const session = await getAuthSession(req);
  const status = req.query.status as string | undefined;

  const conditions = status ? [eq(communitySuggestions.status, status)] : [];

  const rows = await db
    .select({
      id: communitySuggestions.id,
      title: communitySuggestions.title,
      description: communitySuggestions.description,
      status: communitySuggestions.status,
      voteCount: communitySuggestions.voteCount,
      staffResponse: communitySuggestions.staffResponse,
      staffResponseAt: communitySuggestions.staffResponseAt,
      createdAt: communitySuggestions.createdAt,
      authorName: user.name,
      authorUsername: user.username,
    })
    .from(communitySuggestions)
    .leftJoin(user, eq(communitySuggestions.userId, user.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(communitySuggestions.voteCount), desc(communitySuggestions.createdAt))
    .limit(100);

  // If signed in, fetch which ones the user has voted on
  let votedIds: number[] = [];
  if (session?.user?.id) {
    const votes = await db
      .select({ suggestionId: communitySuggestionVotes.suggestionId })
      .from(communitySuggestionVotes)
      .where(eq(communitySuggestionVotes.userId, session.user.id));
    votedIds = votes.map(v => v.suggestionId);
  }

  return res.json({ suggestions: rows, votedIds });
}
