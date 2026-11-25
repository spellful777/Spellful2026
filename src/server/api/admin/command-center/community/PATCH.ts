/**
 * PATCH /api/admin/command-center/community
 * Owner-only moderation actions.
 *
 * Body shapes:
 *   { action: 'resolve-report' | 'dismiss-report', reportId: number }
 *   { action: 'hide-post' | 'unhide-post' | 'pin-post' | 'unpin-post' | 'lock-post' | 'unlock-post', postId: number }
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityPosts, communityReports, communityModActions } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole, writeAuditEvent } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const actorId = session.user.id as string;
  const { action, reportId, postId } = req.body as {
    action?: string;
    reportId?: number;
    postId?: number;
  };

  if (!action) return res.status(400).json({ error: 'action is required' });

  // ── Report actions ──────────────────────────────────────────────────────────
  if (action === 'resolve-report' || action === 'dismiss-report') {
    if (!reportId) return res.status(400).json({ error: 'reportId is required' });
    const newStatus = action === 'resolve-report' ? 'resolved' : 'dismissed';
    await db.update(communityReports)
      .set({ status: newStatus, resolvedBy: actorId, resolvedAt: new Date() })
      .where(eq(communityReports.id, reportId));

    await db.insert(communityModActions).values({
      modId: actorId,
      targetType: 'report',
      targetId: String(reportId),
      action: newStatus,
      reason: null,
    });

    await writeAuditEvent({ actorId, action, targetId: String(reportId) });
    return res.json({ ok: true, status: newStatus });
  }

  // ── Post actions ────────────────────────────────────────────────────────────
  const postActions: Record<string, Partial<typeof communityPosts.$inferInsert>> = {
    'hide-post':   { isHidden: true },
    'unhide-post': { isHidden: false },
    'pin-post':    { isPinned: true },
    'unpin-post':  { isPinned: false },
    'lock-post':   { isLocked: true },
    'unlock-post': { isLocked: false },
  };

  if (postActions[action]) {
    if (!postId) return res.status(400).json({ error: 'postId is required' });
    await db.update(communityPosts)
      .set(postActions[action])
      .where(eq(communityPosts.id, postId));

    await db.insert(communityModActions).values({
      modId: actorId,
      targetType: 'post',
      targetId: String(postId),
      action,
      reason: null,
    });

    await writeAuditEvent({ actorId, action, targetId: String(postId) });
    return res.json({ ok: true });
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
