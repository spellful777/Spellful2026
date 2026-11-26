/**
 * POST /api/moments/run
 * Owner-only: manually trigger the Moments scheduler for today.
 * Safe to call multiple times — the scheduler's own dedup prevents double-sends.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'owner')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    // Dynamic import keeps the scheduler out of the client bundle
    const { runMomentsScheduler } = await import('../../../lib/moments-scheduler.js');
    const result = await runMomentsScheduler();
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: 'Scheduler run failed', detail: String(err) });
  }
}
