/**
 * GET /api/admin/command-center/audit-log
 * Owner-only: paginated audit_events for the last 30 days.
 * Query params:
 *   page       number  (default 1)
 *   limit      number  (default 25, max 100)
 *   actorId    string  filter by actor user id
 *   targetId   string  filter by target user id
 *   action     string  filter by action prefix (e.g. "role." matches role.grant, role.revoke)
 *   q          string  free-text search on action, oldValue, newValue, reason
 *
 * Uses raw SQL (db.execute) to join actor + target user rows without needing
 * drizzle-orm alias, which is not available in drizzle-orm 0.45.x.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

interface AuditRow {
  id: number;
  action: string;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  ip_address: string | null;
  created_at: Date | string;
  actor_id: string;
  actor_name: string | null;
  actor_email: string | null;
  target_id: string | null;
  target_name: string | null;
  target_email: string | null;
}

interface CountRow { total: number | string; }
interface ActionRow { action: string; }

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const page     = Math.max(1, parseInt(String(req.query.page  ?? '1'),  10) || 1);
  const limit    = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25));
  const offset   = (page - 1) * limit;
  const actorId  = typeof req.query.actorId  === 'string' ? req.query.actorId.trim()  : '';
  const targetId = typeof req.query.targetId === 'string' ? req.query.targetId.trim() : '';
  const action   = typeof req.query.action   === 'string' ? req.query.action.trim()   : '';
  const q        = typeof req.query.q        === 'string' ? req.query.q.trim()        : '';

  // 30-day window
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Build WHERE clause fragments
  const extraClauses: ReturnType<typeof sql>[] = [];
  if (actorId)  extraClauses.push(sql`AND ae.actor_id  = ${actorId}`);
  if (targetId) extraClauses.push(sql`AND ae.target_id = ${targetId}`);
  if (action)   extraClauses.push(sql`AND ae.action LIKE ${action + '%'}`);
  if (q) {
    const likePat = `%${q}%`;
    extraClauses.push(sql`AND (ae.action LIKE ${likePat} OR ae.old_value LIKE ${likePat} OR ae.new_value LIKE ${likePat} OR ae.reason LIKE ${likePat})`);
  }

  // Combine extra clauses into one SQL fragment
  const extra = extraClauses.reduce((acc, clause) => sql`${acc} ${clause}`, sql``);

  const [rowsResult, countResult, actionTypesResult] = await Promise.all([
    db.execute<AuditRow>(sql`
      SELECT
        ae.id,
        ae.action,
        ae.old_value,
        ae.new_value,
        ae.reason,
        ae.ip_address,
        ae.created_at,
        ae.actor_id,
        a.name  AS actor_name,
        a.email AS actor_email,
        ae.target_id,
        t.name  AS target_name,
        t.email AS target_email
      FROM audit_events ae
      LEFT JOIN \`user\` a ON ae.actor_id  = a.id
      LEFT JOIN \`user\` t ON ae.target_id = t.id
      WHERE ae.created_at >= ${since}
      ${extra}
      ORDER BY ae.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `),
    db.execute<CountRow>(sql`
      SELECT COUNT(*) AS total
      FROM audit_events ae
      WHERE ae.created_at >= ${since}
      ${extra}
    `),
    db.execute<ActionRow>(sql`
      SELECT DISTINCT action
      FROM audit_events
      WHERE created_at >= ${since}
      ORDER BY action
      LIMIT 200
    `),
  ]);

  // db.execute returns [rows, fields] tuple
  const rows        = (rowsResult as unknown as [AuditRow[]])[0];
  const countRows   = (countResult as unknown as [CountRow[]])[0];
  const actionRows  = (actionTypesResult as unknown as [ActionRow[]])[0];

  const total = Number(countRows[0]?.total ?? 0);

  // Normalise column names to camelCase for the frontend
  const normalised = rows.map(r => ({
    id:          r.id,
    action:      r.action,
    oldValue:    r.old_value,
    newValue:    r.new_value,
    reason:      r.reason,
    ipAddress:   r.ip_address,
    createdAt:   r.created_at,
    actorId:     r.actor_id,
    actorName:   r.actor_name,
    actorEmail:  r.actor_email,
    targetId:    r.target_id,
    targetName:  r.target_name,
    targetEmail: r.target_email,
  }));

  return res.json({
    rows: normalised,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    actionTypes: actionRows.map(r => r.action),
  });
}
