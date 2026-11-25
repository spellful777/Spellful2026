import { selectRows } from '@/server/db/select-rows';
/**
 * GET /api/admin/command-center/dashboard
 * Owner-only KPI dashboard: total members, weekly active, Plus subscribers,
 * community posts (7 days), moderation queue count, and 14-day daily trends.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import {
  user,
  communityPosts,
  communityReports,
  plusSubscriptions,
} from '@/server/db/schema.js';
import { eq, gte, count, sql, and } from 'drizzle-orm';
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
  const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [
    [totalMembers],
    [weeklyActive],
    [plusActive],
    [communityPostsWeek],
    [modQueue],
    [newMembersWeek],
    [newMembersPrevWeek],
    dailySignups,
    dailyPosts,
  ] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(user)
      .where(sql`${user.updatedAt} >= ${since7d}`),
    db.select({ n: count() }).from(plusSubscriptions)
      .where(eq(plusSubscriptions.status, 'active')),
    db.select({ n: count() }).from(communityPosts)
      .where(and(
        gte(communityPosts.createdAt, since7d),
        eq(communityPosts.isHidden, false),
      )),
    db.select({ n: count() }).from(communityReports)
      .where(eq(communityReports.status, 'pending')),
    db.select({ n: count() }).from(user)
      .where(sql`${user.createdAt} >= ${since7d}`),
    db.select({ n: count() }).from(user)
      .where(sql`${user.createdAt} >= ${since14d} AND ${user.createdAt} < ${since7d}`),
    db.execute(sql`
      SELECT DATE(created_at) as day, COUNT(*) as n
      FROM user
      WHERE created_at >= ${since14d}
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `),
    db.execute(sql`
      SELECT DATE(created_at) as day, COUNT(*) as n
      FROM community_posts
      WHERE created_at >= ${since14d} AND is_hidden = 0
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `),
  ]);

  const days14: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    days14.push(d.toISOString().slice(0, 10));
  }

  type DayRow = { day: string; n: string | number };
  const signupRows = (selectRows<DayRow>(dailySignups[0])) ?? [];
  const postRows   = (selectRows<DayRow>(dailyPosts[0])) ?? [];
  const signupMap  = Object.fromEntries(signupRows.map(r => [r.day, Number(r.n)]));
  const postMap    = Object.fromEntries(postRows.map(r => [r.day, Number(r.n)]));

  const totalMembersN   = Number(totalMembers?.n   ?? 0);
  const weeklyActiveN   = Number(weeklyActive?.n   ?? 0);
  const plusActiveN     = Number(plusActive?.n     ?? 0);
  const communityPostsN = Number(communityPostsWeek?.n ?? 0);
  const modQueueN       = Number(modQueue?.n        ?? 0);
  const newMembersWeekN = Number(newMembersWeek?.n  ?? 0);
  const newMembersPrevN = Number(newMembersPrevWeek?.n ?? 0);

  const memberDelta = newMembersPrevN > 0
    ? Math.round(((newMembersWeekN - newMembersPrevN) / newMembersPrevN) * 100)
    : newMembersWeekN > 0 ? 100 : 0;

  return res.json({
    kpis: {
      totalMembers:    totalMembersN,
      weeklyActive:    weeklyActiveN,
      plusSubscribers: plusActiveN,
      communityPosts:  communityPostsN,
      modQueue:        modQueueN,
    },
    trends: {
      newMembersThisWeek: newMembersWeekN,
      newMembersPrevWeek: newMembersPrevN,
      memberDeltaPct:     memberDelta,
    },
    sparklines: {
      signups: days14.map(d => signupMap[d] ?? 0),
      posts:   days14.map(d => postMap[d]   ?? 0),
      days:    days14,
    },
    fetchedAt: now.toISOString(),
  });
}
