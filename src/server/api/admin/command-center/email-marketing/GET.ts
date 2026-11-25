import { selectRows } from '@/server/db/select-rows';
/**
 * GET /api/admin/command-center/email-marketing
 * Owner-only Email Marketing Analytics.
 *
 * Query params:
 *   days=7|30|90  (default 30)
 *
 * Returns real data from:
 *   moments_email_sends   — send log
 *   marketing_consent     — per-user per-category opt-ins
 *   moments_scheduler_state — scheduler health
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

interface SchedulerRow {
  paused: number;
  last_run_at: Date | null;
  last_run_date: string | null;
  last_run_sent_count: number;
  last_run_skip_count: number;
  last_run_error_count: number;
  last_run_error_detail: string | null;
  consecutive_fail_days: number;
}

interface KpiRow {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  unique_recipients: number;
}

interface OccasionRow {
  occasion: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  unique_recipients: number;
  plus_cta_count: number;
}

interface DayRow {
  day: string;
  total: number;
  sent: number;
  failed: number;
}

interface ConsentRow {
  category: string;
  opted_in: number;
  opted_out: number;
}

interface ConsentTotalRow {
  total_with_any_consent: number;
  total_all_opted_in: number;
}

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const days = Math.min(Math.max(parseInt((req.query.days as string) ?? '30', 10) || 30, 1), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const sinceIso = since.toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    const [
      schedulerRows,
      kpiRows,
      occasionRows,
      dayRows,
      consentRows,
      consentTotalRows,
    ] = await Promise.all([
      // Scheduler state
      db.execute(sql`
        SELECT paused, last_run_at, last_run_date,
               last_run_sent_count, last_run_skip_count,
               last_run_error_count, last_run_error_detail,
               consecutive_fail_days
        FROM moments_scheduler_state
        WHERE id = 1
        LIMIT 1
      `),

      // Overall KPIs for the window
      db.execute(sql`
        SELECT
          COUNT(*)                                        AS total,
          SUM(status = 'sent')                            AS sent,
          SUM(status = 'failed')                          AS failed,
          SUM(status = 'skipped')                         AS skipped,
          COUNT(DISTINCT user_id)                         AS unique_recipients
        FROM moments_email_sends
        WHERE scheduled_for >= ${sinceIso}
      `),

      // Per-occasion breakdown
      db.execute(sql`
        SELECT
          occasion,
          COUNT(*)                    AS total,
          SUM(status = 'sent')        AS sent,
          SUM(status = 'failed')      AS failed,
          SUM(status = 'skipped')     AS skipped,
          COUNT(DISTINCT user_id)     AS unique_recipients,
          SUM(included_plus_cta = 1)  AS plus_cta_count
        FROM moments_email_sends
        WHERE scheduled_for >= ${sinceIso}
        GROUP BY occasion
        ORDER BY total DESC
      `),

      // Daily send trend (last N days, up to 90)
      db.execute(sql`
        SELECT
          scheduled_for               AS day,
          COUNT(*)                    AS total,
          SUM(status = 'sent')        AS sent,
          SUM(status = 'failed')      AS failed
        FROM moments_email_sends
        WHERE scheduled_for >= ${sinceIso}
        GROUP BY scheduled_for
        ORDER BY scheduled_for ASC
      `),

      // Consent breakdown by category
      db.execute(sql`
        SELECT
          category,
          SUM(consented = 1)  AS opted_in,
          SUM(consented = 0)  AS opted_out
        FROM marketing_consent
        GROUP BY category
        ORDER BY category ASC
      `),

      // Total unique users with any consent record
      db.execute(sql`
        SELECT
          COUNT(DISTINCT user_id)                                         AS total_with_any_consent,
          COUNT(DISTINCT CASE WHEN all_in = 5 THEN user_id END)          AS total_all_opted_in
        FROM (
          SELECT user_id, SUM(consented = 1) AS all_in
          FROM marketing_consent
          WHERE category IN ('birthday','moon_seasonal','community','discovery','plus_offers')
          GROUP BY user_id
        ) sub
      `),
    ]);

    const scheduler = (selectRows<SchedulerRow>(schedulerRows[0]))[0] ?? null;
    const kpi = ((selectRows<KpiRow>(kpiRows[0]))[0]) ?? { total: 0, sent: 0, failed: 0, skipped: 0, unique_recipients: 0 };
    const occasions = (selectRows<OccasionRow>(occasionRows[0]));
    const days_series = (selectRows<DayRow>(dayRows[0]));
    const consent = (selectRows<ConsentRow>(consentRows[0]));
    const consentTotal = ((selectRows<ConsentTotalRow>(consentTotalRows[0]))[0]) ?? { total_with_any_consent: 0, total_all_opted_in: 0 };

    // Delivery rate: sent / total (avoid div-by-zero)
    const deliveryRate = kpi.total > 0 ? Math.round((Number(kpi.sent) / Number(kpi.total)) * 1000) / 10 : null;

    return res.json({
      days,
      since: sinceIso,
      scheduler: scheduler ? {
        paused: Boolean(scheduler.paused),
        lastRunAt: scheduler.last_run_at,
        lastRunDate: scheduler.last_run_date,
        lastRunSentCount: Number(scheduler.last_run_sent_count),
        lastRunSkipCount: Number(scheduler.last_run_skip_count),
        lastRunErrorCount: Number(scheduler.last_run_error_count),
        lastRunErrorDetail: scheduler.last_run_error_detail,
        consecutiveFailDays: Number(scheduler.consecutive_fail_days),
      } : null,
      kpis: {
        total: Number(kpi.total),
        sent: Number(kpi.sent),
        failed: Number(kpi.failed),
        skipped: Number(kpi.skipped),
        uniqueRecipients: Number(kpi.unique_recipients),
        deliveryRate,
      },
      occasions: occasions.map(o => ({
        occasion: o.occasion,
        total: Number(o.total),
        sent: Number(o.sent),
        failed: Number(o.failed),
        skipped: Number(o.skipped),
        uniqueRecipients: Number(o.unique_recipients),
        plusCtaCount: Number(o.plus_cta_count),
        deliveryRate: Number(o.total) > 0
          ? Math.round((Number(o.sent) / Number(o.total)) * 1000) / 10
          : null,
      })),
      trend: days_series.map(d => ({
        day: d.day,
        total: Number(d.total),
        sent: Number(d.sent),
        failed: Number(d.failed),
      })),
      consent: {
        categories: consent.map(c => ({
          category: c.category,
          optedIn: Number(c.opted_in),
          optedOut: Number(c.opted_out),
        })),
        totalWithAnyConsent: Number(consentTotal.total_with_any_consent),
        totalAllOptedIn: Number(consentTotal.total_all_opted_in),
      },
    });
  } catch (err) {
    console.error('[email-marketing analytics]', err);
    return res.status(500).json({ error: 'Failed to load email marketing analytics' });
  }
}
