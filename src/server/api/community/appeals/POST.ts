/**
 * POST /api/community/appeals
 * Submit a moderation appeal. Authenticated users only.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityAppeals } from '@/server/db/schema.js';
import { and, eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const { targetType, targetId, reason } = req.body as {
    targetType?: string; targetId?: number; reason?: string;
  };

  if (!targetType || targetId === undefined || !reason?.trim()) {
    return res.status(400).json({ error: 'targetType, targetId, and reason are required' });
  }

  // One pending appeal per user per target
  const [existing] = await db
    .select({ id: communityAppeals.id })
    .from(communityAppeals)
    .where(and(
      eq(communityAppeals.userId, session.user.id),
      eq(communityAppeals.targetType, targetType),
      eq(communityAppeals.targetId, Number(targetId)),
      eq(communityAppeals.status, 'pending'),
    ))
    .limit(1);

  if (existing) return res.status(409).json({ error: 'Appeal already submitted' });

  await db.insert(communityAppeals).values({
    userId: session.user.id,
    targetType,
    targetId: Number(targetId),
    reason: reason.trim().slice(0, 2000),
  });

  return res.status(201).json({ ok: true });
}
