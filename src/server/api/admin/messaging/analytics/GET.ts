import { selectRows } from '@/server/db/select-rows';
/**
 * GET /api/admin/messaging/analytics
 * Messaging KPIs for the admin console.
 * Requires admin or owner role.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { conversations, groupConversations, groupMembers } from '@/server/db/schema.js';
import { count, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const now = new Date();
  const since7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
  const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    [totalConvs],
    [totalGroups],
    [totalGroupMembers],
    totalMsgsRow,
    msgLast7dRow,
    msgLast30dRow,
    pendingReportsRow,
    resolvedReportsRow,
    dailyMsgsRow,
    topReportedRow,
  ] = await Promise.all([
    db.select({ n: count() }).from(conversations),
    db.select({ n: count() }).from(groupConversations),
    db.select({ n: count() }).from(groupMembers),

    db.execute(sql`SELECT COUNT(*) AS n FROM messages`),
    db.execute(sql`SELECT COUNT(*) AS n FROM messages WHERE created_at >= ${since7d}`),
    db.execute(sql`SELECT COUNT(*) AS n FROM messages WHERE created_at >= ${since30d}`),

    db.execute(sql`SELECT COUNT(*) AS n FROM message_reports WHERE status = 'pending'`),
    db.execute(sql`SELECT COUNT(*) AS n FROM message_reports WHERE status != 'pending'`),

    // Daily message volume for the last 14 days
    db.execute(sql`
      SELECT DATE(created_at) AS day, COUNT(*) AS n
      FROM messages
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `),

    // Top 5 most-reported users
    db.execute(sql`
      SELECT
        mr.reported_user_id,
        u.username,
        u.name,
        COUNT(*) AS report_count
      FROM message_reports mr
      LEFT JOIN user u ON u.id = mr.reported_user_id
      GROUP BY mr.reported_user_id, u.username, u.name
      ORDER BY report_count DESC
      LIMIT 5
    `),
  ]);

  type DayRow = { day: string; n: string | number };
  type CountRow = { n: string | number };
  type TopRow = { reported_user_id: string; username: string | null; name: string | null; report_count: string | number };

  const dailyRows = (selectRows<DayRow>(dailyMsgsRow[0])) ?? [];
  const topRows   = (selectRows<TopRow>(topReportedRow[0])) ?? [];

  // Build 14-day array
  const days14: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    days14.push(d.toISOString().slice(0, 10));
  }
  const dailyMap = Object.fromEntries(dailyRows.map(r => [r.day, Number(r.n)]));
  const dailyMessages = days14.map(d => dailyMap[d] ?? 0);

  return res.json({
    kpis: {
      totalConversations:  Number(totalConvs?.n ?? 0),
      totalGroups:         Number(totalGroups?.n ?? 0),
      totalGroupMembers:   Number(totalGroupMembers?.n ?? 0),
      totalMessages:       Number(((selectRows<CountRow>(totalMsgsRow[0]))[0])?.n ?? 0),
      messagesLast7d:      Number(((selectRows<CountRow>(msgLast7dRow[0]))[0])?.n ?? 0),
      messagesLast30d:     Number(((selectRows<CountRow>(msgLast30dRow[0]))[0])?.n ?? 0),
      pendingReports:      Number(((selectRows<CountRow>(pendingReportsRow[0]))[0])?.n ?? 0),
      resolvedReports:     Number(((selectRows<CountRow>(resolvedReportsRow[0]))[0])?.n ?? 0),
    },
    sparklines: {
      dailyMessages,
      days: days14,
    },
    topReported: topRows.map(r => ({
      userId:      r.reported_user_id,
      username:    r.username,
      name:        r.name,
      reportCount: Number(r.report_count),
    })),
  });
}
