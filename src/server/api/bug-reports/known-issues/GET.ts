/**
 * GET /api/bug-reports/known-issues
 * Returns publicly visible known issues (admin-flagged resolved reports).
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { bugReports } from '@/server/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export default async function handler(_req: Request, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const rows = await db
    .select({
      id: bugReports.id,
      knownIssueTitle: bugReports.knownIssueTitle,
      status: bugReports.status,
      adminNote: bugReports.adminNote,
      resolvedAt: bugReports.resolvedAt,
      createdAt: bugReports.createdAt,
    })
    .from(bugReports)
    .where(and(eq(bugReports.isKnownIssue, true)))
    .orderBy(desc(bugReports.createdAt))
    .limit(30);

  return res.json({ issues: rows });
}
