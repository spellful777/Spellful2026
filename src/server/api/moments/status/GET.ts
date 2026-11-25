/**
 * GET /api/moments/status
 * Owner-only: returns scheduler state, queue depth, and allows pause/resume.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

interface StateRow {
  paused: number;
  last_run_at: Date | null;
  last_run_date: string | null;
  last_run_sent_count: number;
  last_run_skip_count: number;
  last_run_error_count: number;
  last_run_error_detail: string | null;
  consecutive_fail_days: number;
}

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'owner')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const [stateRows] = await db.execute<StateRow>(
    sql`SELECT paused, last_run_at, last_run_date, last_run_sent_count,
               last_run_skip_count, last_run_error_count, last_run_error_detail,
               consecutive_fail_days
        FROM moments_scheduler_state WHERE id = 1 LIMIT 1`,
  );

  const [queueRows] = await db.execute<{ queued: number }>(
    sql`SELECT COUNT(*) AS queued FROM moments_email_sends WHERE status = 'queued'`,
  );

  const [recentRows] = await db.execute<{
    occasion: string; status: string; scheduled_for: string; created_at: Date;
  }>(
    sql`SELECT occasion, status, scheduled_for, created_at
        FROM moments_email_sends
        ORDER BY created_at DESC LIMIT 20`,
  );

  const state = (stateRows as StateRow[])[0] ?? null;
  const queueDepth = Number((queueRows as { queued: number }[])[0]?.queued ?? 0);

  return res.json({
    paused: Boolean(state?.paused),
    lastRunAt: state?.last_run_at ?? null,
    lastRunDate: state?.last_run_date ?? null,
    lastRunSentCount: state?.last_run_sent_count ?? 0,
    lastRunSkipCount: state?.last_run_skip_count ?? 0,
    lastRunErrorCount: state?.last_run_error_count ?? 0,
    lastRunErrorDetail: state?.last_run_error_detail ?? null,
    consecutiveFailDays: state?.consecutive_fail_days ?? 0,
    queueDepth,
    recentSends: recentRows,
  });
}
