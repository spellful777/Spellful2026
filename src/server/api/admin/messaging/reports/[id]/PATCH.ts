import { selectRows } from '@/server/db/select-rows';
/**
 * PATCH /api/admin/messaging/reports/:id
 * Resolve or dismiss a message report.
 * Body: { action: 'resolve' | 'dismiss' | 'warn' | 'restrict', note?: string }
 * Requires admin or owner role.
 * Records the decision in audit_events.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { auditEvents } from '@/server/db/schema.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const reportId = parseInt(req.params.id);
  if (isNaN(reportId)) return res.status(400).json({ error: 'Invalid id' });

  const { action, note } = req.body as { action?: string; note?: string };
  const validActions = ['resolve', 'dismiss', 'warn', 'restrict'];
  if (!action || !validActions.includes(action)) {
    return res.status(400).json({ error: `action must be one of: ${validActions.join(', ')}` });
  }

  // Fetch the report to get reported_user_id for audit
  const reportRow = await db.execute(sql`
    SELECT id, reported_user_id, status FROM message_reports WHERE id = ${reportId} LIMIT 1
  `);
  type ReportRow = { id: number; reported_user_id: string; status: string };
  const report = ((selectRows<ReportRow>(reportRow[0]))[0]);
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (report.status !== 'pending') return res.status(409).json({ error: 'Report already reviewed' });

  // Update the report
  await db.execute(sql`
    UPDATE message_reports
    SET status = ${action}, reviewed_by = ${session.user.id}, reviewed_at = NOW()
    WHERE id = ${reportId}
  `);

  // Record in audit_events
  await db.insert(auditEvents).values({
    actorId:   session.user.id,
    targetId:  report.reported_user_id,
    action:    `msg_report_${action}`,
    oldValue:  'pending',
    newValue:  action,
    reason:    note ?? `Message report #${reportId} ${action}d by moderator`,
  });

  return res.json({ ok: true, action });
}
