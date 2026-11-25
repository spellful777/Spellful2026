/**
 * GET /api/admin/command-center/monetization
 * Owner-only: Plus subscriber KPIs, status breakdown, churn indicators,
 * environment split, and recent subscription activity.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { plusSubscriptions } from '@/server/db/schema.js';
import { eq, count, and, gte, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

// Monthly price in USD (display only — actual billing is through Apple IAP)
const MONTHLY_PRICE_USD = 4.99;

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

  const [
    activeRows,
    gracePeriodRows,
    expiredRows,
    cancelledRows,
    refundedRows,
    sandboxRows,
    newLast30Rows,
    newLast7Rows,
    cancelledLast30Rows,
    recentRows,
  ] = await Promise.all([
    db.select({ n: count() }).from(plusSubscriptions).where(eq(plusSubscriptions.status, 'active')),
    db.select({ n: count() }).from(plusSubscriptions).where(eq(plusSubscriptions.status, 'grace_period')),
    db.select({ n: count() }).from(plusSubscriptions).where(eq(plusSubscriptions.status, 'expired')),
    db.select({ n: count() }).from(plusSubscriptions).where(eq(plusSubscriptions.status, 'cancelled')),
    db.select({ n: count() }).from(plusSubscriptions).where(eq(plusSubscriptions.status, 'refunded')),
    db.select({ n: count() }).from(plusSubscriptions).where(
      and(eq(plusSubscriptions.status, 'active'), eq(plusSubscriptions.environment, 'sandbox'))
    ),
    db.select({ n: count() }).from(plusSubscriptions).where(
      and(eq(plusSubscriptions.status, 'active'), gte(plusSubscriptions.createdAt, thirtyDaysAgo))
    ),
    db.select({ n: count() }).from(plusSubscriptions).where(
      and(eq(plusSubscriptions.status, 'active'), gte(plusSubscriptions.createdAt, sevenDaysAgo))
    ),
    db.select({ n: count() }).from(plusSubscriptions).where(
      and(eq(plusSubscriptions.status, 'cancelled'), gte(plusSubscriptions.cancelledAt, thirtyDaysAgo))
    ),
    db.select({
      id: plusSubscriptions.id,
      status: plusSubscriptions.status,
      environment: plusSubscriptions.environment,
      appleProductId: plusSubscriptions.appleProductId,
      createdAt: plusSubscriptions.createdAt,
      expiresAt: plusSubscriptions.expiresAt,
      cancelledAt: plusSubscriptions.cancelledAt,
    })
    .from(plusSubscriptions)
    .orderBy(sql`${plusSubscriptions.createdAt} DESC`)
    .limit(10),
  ]);

  const active      = Number(activeRows[0]?.n ?? 0);
  const gracePeriod = Number(gracePeriodRows[0]?.n ?? 0);
  const expired     = Number(expiredRows[0]?.n ?? 0);
  const cancelled   = Number(cancelledRows[0]?.n ?? 0);
  const refunded    = Number(refundedRows[0]?.n ?? 0);
  const sandbox     = Number(sandboxRows[0]?.n ?? 0);
  const newLast30   = Number(newLast30Rows[0]?.n ?? 0);
  const newLast7    = Number(newLast7Rows[0]?.n ?? 0);
  const churnLast30 = Number(cancelledLast30Rows[0]?.n ?? 0);

  const production = active - sandbox;
  const total = active + gracePeriod + expired + cancelled + refunded;

  // Churn rate: cancellations in last 30d / (active at start of period, approximated)
  const activeAtPeriodStart = active + churnLast30;
  const churnRate = activeAtPeriodStart > 0
    ? Math.round((churnLast30 / activeAtPeriodStart) * 1000) / 10
    : 0;

  // MRR estimate: production active subs only (sandbox excluded)
  const mrrEstimate = Math.round(production * MONTHLY_PRICE_USD * 100) / 100;

  return res.json({
    kpis: {
      active,
      gracePeriod,
      production,
      sandbox,
      mrrEstimate,
      newLast30,
      newLast7,
      churnLast30,
      churnRate,
    },
    statusBreakdown: [
      { status: 'active',       count: active,      color: 'success' },
      { status: 'grace_period', count: gracePeriod, color: 'warning' },
      { status: 'expired',      count: expired,     color: 'muted' },
      { status: 'cancelled',    count: cancelled,   color: 'destructive' },
      { status: 'refunded',     count: refunded,    color: 'destructive' },
    ],
    total,
    recentActivity: recentRows,
    priceUsd: MONTHLY_PRICE_USD,
  });
}
