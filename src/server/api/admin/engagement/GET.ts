import type { Request, Response } from 'express';
import { db } from '../../../db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '../../../lib/auth-session.js';
import { hasRole } from '../../../lib/require-role.js';

/**
 * GET /api/admin/engagement
 * Returns privacy-respecting aggregate engagement metrics for the admin dashboard.
 * Requires admin or owner role.
 *
 * Metrics returned:
 *   - weeklyActiveMembers  : distinct users with any activity in the last 7 days
 *   - firstWeekActivationRate : % of users who joined <=7 days ago and completed onboarding
 *   - postsWithReplies     : community posts that have at least one reply (last 30 days)
 *   - newConversations     : new DM conversations started (last 7 days)
 *   - notificationDelivery : community notifications sent vs read (last 7 days)
 *   - day7ReturnRate       : % of users who joined 7-14 days ago and were active in last 7 days
 *   - day30ReturnRate      : % of users who joined 30-60 days ago and were active in last 30 days
 *   - dailyCheckinTrend    : check-ins per day for the last 14 days
 *   - weeklyPostTrend      : community posts per day for the last 14 days
 */
export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    res.status(403).json({ error: 'Forbidden' }); return;
  }

  try {
    const [
      wamRows,
      activationRows,
      postsWithRepliesRows,
      newConvRows,
      notifRows,
      day7Rows,
      day30Rows,
      checkinTrendRows,
      postTrendRows,
    ] = await Promise.all([
      // Weekly active members: distinct users who posted, replied, checked in, or sent a message in last 7 days
      db.execute(sql`
        SELECT COUNT(DISTINCT uid) AS n FROM (
          SELECT user_id AS uid FROM community_posts   WHERE created_at >= NOW() - INTERVAL 7 DAY AND is_hidden = FALSE
          UNION ALL
          SELECT user_id AS uid FROM community_replies WHERE created_at >= NOW() - INTERVAL 7 DAY AND is_hidden = FALSE
          UNION ALL
          SELECT user_id AS uid FROM daily_checkins    WHERE created_at >= NOW() - INTERVAL 7 DAY
          UNION ALL
          SELECT sender_id AS uid FROM messages        WHERE created_at >= NOW() - INTERVAL 7 DAY
        ) AS activity
      `),

      // First-week activation: users who joined <= 7 days ago and have onboarding_complete = TRUE
      db.execute(sql`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN dp.onboarding_complete = TRUE THEN 1 ELSE 0 END) AS activated
        FROM user u
        LEFT JOIN dashboard_preferences dp ON dp.user_id = u.id
        WHERE u.created_at >= NOW() - INTERVAL 7 DAY
          AND u.platform_role = 'member'
      `),

      // Posts with at least one reply in last 30 days
      db.execute(sql`
        SELECT COUNT(*) AS n
        FROM community_posts
        WHERE created_at >= NOW() - INTERVAL 30 DAY
          AND is_hidden = FALSE
          AND reply_count > 0
      `),

      // New DM conversations in last 7 days
      db.execute(sql`
        SELECT COUNT(*) AS n FROM conversations
        WHERE created_at >= NOW() - INTERVAL 7 DAY
      `),

      // Notification delivery: sent vs read in last 7 days
      db.execute(sql`
        SELECT
          COUNT(*) AS sent,
          SUM(CASE WHEN is_read = TRUE THEN 1 ELSE 0 END) AS read_count
        FROM community_notifications
        WHERE created_at >= NOW() - INTERVAL 7 DAY
      `),

      // Day-7 return rate: users who joined 7-14 days ago and were active in last 7 days
      db.execute(sql`
        SELECT
          COUNT(DISTINCT u.id) AS cohort,
          COUNT(DISTINCT act.uid) AS returned
        FROM user u
        LEFT JOIN (
          SELECT user_id AS uid FROM community_posts   WHERE created_at >= NOW() - INTERVAL 7 DAY
          UNION ALL
          SELECT user_id AS uid FROM community_replies WHERE created_at >= NOW() - INTERVAL 7 DAY
          UNION ALL
          SELECT user_id AS uid FROM daily_checkins    WHERE created_at >= NOW() - INTERVAL 7 DAY
        ) AS act ON act.uid = u.id
        WHERE u.created_at >= NOW() - INTERVAL 14 DAY
          AND u.created_at < NOW() - INTERVAL 7 DAY
          AND u.platform_role = 'member'
      `),

      // Day-30 return rate: users who joined 30-60 days ago and were active in last 30 days
      db.execute(sql`
        SELECT
          COUNT(DISTINCT u.id) AS cohort,
          COUNT(DISTINCT act.uid) AS returned
        FROM user u
        LEFT JOIN (
          SELECT user_id AS uid FROM community_posts   WHERE created_at >= NOW() - INTERVAL 30 DAY
          UNION ALL
          SELECT user_id AS uid FROM community_replies WHERE created_at >= NOW() - INTERVAL 30 DAY
          UNION ALL
          SELECT user_id AS uid FROM daily_checkins    WHERE created_at >= NOW() - INTERVAL 30 DAY
        ) AS act ON act.uid = u.id
        WHERE u.created_at >= NOW() - INTERVAL 60 DAY
          AND u.created_at < NOW() - INTERVAL 30 DAY
          AND u.platform_role = 'member'
      `),

      // Daily check-in trend: last 14 days
      db.execute(sql`
        SELECT DATE(created_at) AS day, COUNT(*) AS n
        FROM daily_checkins
        WHERE created_at >= NOW() - INTERVAL 14 DAY
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `),

      // Weekly post trend: last 14 days
      db.execute(sql`
        SELECT DATE(created_at) AS day, COUNT(*) AS n
        FROM community_posts
        WHERE created_at >= NOW() - INTERVAL 14 DAY
          AND is_hidden = FALSE
        GROUP BY DATE(created_at)
        ORDER BY day ASC
      `),
    ]);

    // Helper: extract first row from db.execute result
    const row0 = (r: unknown) => (r as [Record<string, unknown>[], unknown])[0][0] ?? {};
    const rows = (r: unknown) => (r as [Record<string, unknown>[], unknown])[0];

    const wam = row0(wamRows);
    const act = row0(activationRows);
    const pwr = row0(postsWithRepliesRows);
    const conv = row0(newConvRows);
    const notif = row0(notifRows);
    const d7 = row0(day7Rows);
    const d30 = row0(day30Rows);

    const toNum = (v: unknown) => Number(v ?? 0);
    const toPct = (num: number, den: number) =>
      den === 0 ? null : Math.round((num / den) * 1000) / 10; // one decimal

    res.json({
      weeklyActiveMembers: toNum(wam.n),
      firstWeekActivation: {
        total: toNum(act.total),
        activated: toNum(act.activated),
        rate: toPct(toNum(act.activated), toNum(act.total)),
      },
      postsWithReplies: toNum(pwr.n),
      newConversations: toNum(conv.n),
      notificationDelivery: {
        sent: toNum(notif.sent),
        read: toNum(notif.read_count),
        rate: toPct(toNum(notif.read_count), toNum(notif.sent)),
      },
      day7ReturnRate: {
        cohort: toNum(d7.cohort),
        returned: toNum(d7.returned),
        rate: toPct(toNum(d7.returned), toNum(d7.cohort)),
      },
      day30ReturnRate: {
        cohort: toNum(d30.cohort),
        returned: toNum(d30.returned),
        rate: toPct(toNum(d30.returned), toNum(d30.cohort)),
      },
      dailyCheckinTrend: rows(checkinTrendRows).map((r) => ({
        day: String(r.day).slice(0, 10),
        n: toNum(r.n),
      })),
      weeklyPostTrend: rows(postTrendRows).map((r) => ({
        day: String(r.day).slice(0, 10),
        n: toNum(r.n),
      })),
    });
  } catch (e) {
    console.error(JSON.stringify({ event: 'admin.engagement.error', msg: String(e).slice(0, 200) }));
    res.status(500).json({ error: 'Failed to load engagement metrics' });
  }
}
