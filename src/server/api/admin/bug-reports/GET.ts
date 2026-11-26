/**
 * GET /api/admin/bug-reports
 * Returns bug reports for admin review. Requires admin role.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { bugReports, user } from '@/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const status = req.query.status as string | undefined;

  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      category: bugReports.category,
      description: bugReports.description,
      stepsToReproduce: bugReports.stepsToReproduce,
      expectedBehavior: bugReports.expectedBehavior,
      deviceInfo: bugReports.deviceInfo,
      pageUrl: bugReports.pageUrl,
      status: bugReports.status,
      ticketRef: bugReports.ticketRef,
      adminNote: bugReports.adminNote,
      isKnownIssue: bugReports.isKnownIssue,
      knownIssueTitle: bugReports.knownIssueTitle,
      createdAt: bugReports.createdAt,
      resolvedAt: bugReports.resolvedAt,
      reporterName: user.name,
      reporterUsername: user.username,
    })
    .from(bugReports)
    .leftJoin(user, eq(bugReports.reporterId, user.id))
    .where(status ? eq(bugReports.status, status) : undefined)
    .orderBy(desc(bugReports.createdAt))
    .limit(200);

  return res.json({ reports: rows });
}
