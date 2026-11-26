import type { Request, Response } from 'express';
import { and, count, eq, or } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { covenConnections, userFollows } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  const memberId = (await getAuthSession(req))?.user?.id;
  if (!memberId) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const receiver = eq(covenConnections.receiverId, memberId);
  const participant = or(receiver, eq(covenConnections.requesterId, memberId));

  try {
    const [[members], [requests], [followers]] = await Promise.all([
      db.select({ total: count() }).from(covenConnections)
        .where(and(participant, eq(covenConnections.status, 'accepted'))),
      db.select({ total: count() }).from(covenConnections)
        .where(and(receiver, eq(covenConnections.status, 'pending'))),
      db.select({ total: count() }).from(userFollows).where(eq(userFollows.followingId, memberId)),
    ]);
    return res.json({
      covenCount: members.total,
      pendingRequests: requests.total,
      followerCount: followers.total,
    });
  } catch {
    return res.status(503).json({ error: 'Social counts temporarily unavailable' });
  }
}
