import { selectRows } from '@/server/db/select-rows';
/**
 * GET /api/admin/messaging/reports
 * Reported message queue for moderators.
 * Returns report metadata + reporter/reported usernames.
 * Message content is NOT returned (E2E encrypted, inaccessible).
 * Requires admin or owner role.
 * Query: ?status=pending|resolved|all&limit=25&offset=0
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  const limit  = Math.min(Number(req.query.limit)  || 25, 100);
  const offset = Number(req.query.offset) || 0;

  const statusClause = status === 'all'
    ? sql`1=1`
    : status === 'resolved'
      ? sql`mr.status != 'pending'`
      : sql`mr.status = 'pending'`;

  const [rows, countRow] = await Promise.all([
    db.execute(sql`
      SELECT
        mr.id,
        mr.message_id,
        mr.conversation_id,
        mr.reason,
        mr.details,
        mr.status,
        mr.created_at,
        mr.reviewed_at,
        reporter.username  AS reporter_username,
        reporter.name      AS reporter_name,
        reported.username  AS reported_username,
        reported.name      AS reported_name,
        reviewer.username  AS reviewer_username,
        -- Conversation participants for context (no message content)
        p1.username AS conv_p1_username,
        p2.username AS conv_p2_username,
        (SELECT COUNT(*) FROM message_reports mr2 WHERE mr2.reported_user_id = mr.reported_user_id) AS total_reports_on_user
      FROM message_reports mr
      LEFT JOIN user reporter ON reporter.id = mr.reporter_id
      LEFT JOIN user reported ON reported.id = mr.reported_user_id
      LEFT JOIN user reviewer ON reviewer.id = mr.reviewed_by
      LEFT JOIN conversations c ON c.id = mr.conversation_id
      LEFT JOIN user p1 ON p1.id = c.participant1_id
      LEFT JOIN user p2 ON p2.id = c.participant2_id
      WHERE ${statusClause}
      ORDER BY mr.created_at DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    `),
    db.execute(sql`
      SELECT COUNT(*) AS n FROM message_reports mr WHERE ${statusClause}
    `),
  ]);

  type ReportRow = {
    id: number;
    message_id: number;
    conversation_id: number;
    reason: string;
    details: string | null;
    status: string;
    created_at: string;
    reviewed_at: string | null;
    reporter_username: string | null;
    reporter_name: string | null;
    reported_username: string | null;
    reported_name: string | null;
    reviewer_username: string | null;
    conv_p1_username: string | null;
    conv_p2_username: string | null;
    total_reports_on_user: string | number;
  };
  type CountRow = { n: string | number };

  const reportRows = (selectRows<ReportRow>(rows[0])) ?? [];
  const total = Number(((selectRows<CountRow>(countRow[0]))[0])?.n ?? 0);

  return res.json({
    reports: reportRows.slice(0, limit).map(r => ({
      id:                  r.id,
      messageId:           r.message_id,
      conversationId:      r.conversation_id,
      reason:              r.reason,
      details:             r.details,
      status:              r.status,
      createdAt:           r.created_at,
      reviewedAt:          r.reviewed_at,
      reporterUsername:    r.reporter_username,
      reporterName:        r.reporter_name,
      reportedUsername:    r.reported_username,
      reportedName:        r.reported_name,
      reviewerUsername:    r.reviewer_username,
      convP1Username:      r.conv_p1_username,
      convP2Username:      r.conv_p2_username,
      totalReportsOnUser:  Number(r.total_reports_on_user),
    })),
    hasMore: reportRows.length > limit,
    total,
  });
}
