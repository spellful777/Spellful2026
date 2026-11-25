/**
 * GET /api/admin/command-center/community
 * Owner-only: recent posts + pending moderation queue.
 * Query: ?view=posts|queue&limit=25&offset=0
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import {
  communityPosts,
  communityReports,
  user,
} from '@/server/db/schema.js';
import { eq, desc, count } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const view   = typeof req.query.view   === 'string' ? req.query.view   : 'posts';
  const limit  = Math.min(Number(req.query.limit)  || 25, 100);
  const offset = Number(req.query.offset) || 0;

  if (view === 'queue') {
    // Pending reports with reporter info
    const [reports, [totalRow]] = await Promise.all([
      db.select({
        id:             communityReports.id,
        targetType:     communityReports.targetType,
        targetId:       communityReports.targetId,
        targetStringId: communityReports.targetStringId,
        reason:         communityReports.reason,
        details:        communityReports.details,
        status:         communityReports.status,
        createdAt:      communityReports.createdAt,
        reporterName:   user.name,
        reporterUsername: user.username,
      })
        .from(communityReports)
        .leftJoin(user, eq(communityReports.reporterId, user.id))
        .where(eq(communityReports.status, 'pending'))
        .orderBy(desc(communityReports.createdAt))
        .limit(limit + 1)
        .offset(offset),

      db.select({ n: count() })
        .from(communityReports)
        .where(eq(communityReports.status, 'pending')),
    ]);

    return res.json({
      reports: reports.slice(0, limit),
      hasMore: reports.length > limit,
      total: Number(totalRow?.n ?? 0),
    });
  }

  // Default: recent posts with author info
  const [posts, [totalRow]] = await Promise.all([
    db.select({
      id:          communityPosts.id,
      title:       communityPosts.title,
      type:        communityPosts.type,
      isHidden:    communityPosts.isHidden,
      isPinned:    communityPosts.isPinned,
      isLocked:    communityPosts.isLocked,
      likeCount:   communityPosts.likeCount,
      replyCount:  communityPosts.replyCount,
      createdAt:   communityPosts.createdAt,
      authorName:  user.name,
      authorUsername: user.username,
    })
      .from(communityPosts)
      .leftJoin(user, eq(communityPosts.userId, user.id))
      .orderBy(desc(communityPosts.createdAt))
      .limit(limit + 1)
      .offset(offset),

    db.select({ n: count() }).from(communityPosts),
  ]);

  return res.json({
    posts: posts.slice(0, limit),
    hasMore: posts.length > limit,
    total: Number(totalRow?.n ?? 0),
  });
}
