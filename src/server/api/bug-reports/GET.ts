/**
 * GET /api/bug-reports
 * Returns the signed-in user's own bug reports.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { bugReports } from '@/server/db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const rows = await db
    .select({
      id: bugReports.id,
      title: bugReports.title,
      category: bugReports.category,
      status: bugReports.status,
      ticketRef: bugReports.ticketRef,
      adminNote: bugReports.adminNote,
      createdAt: bugReports.createdAt,
      resolvedAt: bugReports.resolvedAt,
    })
    .from(bugReports)
    .where(eq(bugReports.reporterId, session.user.id))
    .orderBy(desc(bugReports.createdAt))
    .limit(50);

  return res.json({ reports: rows });
}
