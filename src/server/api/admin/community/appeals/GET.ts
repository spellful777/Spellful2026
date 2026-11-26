/**
 * GET /api/admin/community/appeals
 * Returns moderation appeals. Requires admin role.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityAppeals, user } from '@/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const status = (req.query.status as string) || 'pending';

  const rows = await db
    .select({
      id: communityAppeals.id,
      targetType: communityAppeals.targetType,
      targetId: communityAppeals.targetId,
      reason: communityAppeals.reason,
      status: communityAppeals.status,
      adminNote: communityAppeals.adminNote,
      createdAt: communityAppeals.createdAt,
      reviewedAt: communityAppeals.reviewedAt,
      userName: user.name,
      userUsername: user.username,
    })
    .from(communityAppeals)
    .leftJoin(user, eq(communityAppeals.userId, user.id))
    .where(eq(communityAppeals.status, status))
    .orderBy(desc(communityAppeals.createdAt))
    .limit(100);

  return res.json({ appeals: rows });
}
