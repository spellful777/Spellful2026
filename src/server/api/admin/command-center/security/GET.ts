/**
 * GET /api/admin/command-center/security
 * Owner-only Security & Trust dashboard data.
 *
 * Returns aggregated security signals — never raw message bodies,
 * journal contents, exact birth data, payment numbers, or raw tokens.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!hasRole(session, 'admin')) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  if (!db) {
    res.status(503).json({ error: 'Database unavailable' });
    return;
  }

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const last7d  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
  const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

  try {
    const [
      authAudit,
      roleChanges,
      deletionQueue,
      blocksTotal,
      reportsOpen,
      reportsTotal7d,
      emailOptOuts,
      activeSessionsApprox,
      newAccounts24h,
      suspendedAccounts,
      ownerSeedAttempts,
    ] = await Promise.all([
      // Auth-related audit events in last 24h
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM audit_events
        WHERE action IN ('auth.login', 'auth.login_failed', 'auth.logout', 'auth.password_reset')
          AND created_at >= ${last24h}
      `),

      // Role changes in last 7 days
      db.execute<{ count: number; action: string }>(sql`
        SELECT action, COUNT(*) AS count FROM audit_events
        WHERE action IN ('role.grant', 'role.revoke', 'role.change')
          AND created_at >= ${last7d}
        GROUP BY action
      `),

      // Accounts pending deletion
      db.execute<{ count: number; oldest: string | null }>(sql`
        SELECT COUNT(*) AS count,
               MIN(deletion_requested_at) AS oldest
        FROM \`user\`
        WHERE deletion_requested_at IS NOT NULL
      `),

      // Total active blocks
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM community_blocks
      `),

      // Open moderation reports
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM community_reports
        WHERE status = 'pending'
      `),

      // Reports filed in last 7 days
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM community_reports
        WHERE created_at >= ${last7d}
      `),

      // Marketing opt-outs (consented = false) in last 30 days
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM marketing_consent
        WHERE consented = FALSE
          AND updated_at >= ${last30d}
      `),

      // Approximate active sessions (created in last 30 days)
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM session
        WHERE created_at >= ${last30d}
          AND expires_at > NOW()
      `),

      // New accounts in last 24h
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM \`user\`
        WHERE created_at >= ${last24h}
          AND email_verified = TRUE
      `),

      // Suspended/banned accounts
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM \`user\`
        WHERE platform_role = 'banned'
           OR deletion_requested_at IS NOT NULL
      `),

      // Attempts to call the retired owner-seed endpoint (audit log)
      db.execute<{ count: number }>(sql`
        SELECT COUNT(*) AS count FROM audit_events
        WHERE action = 'security.owner_seed_attempt'
          AND created_at >= ${last7d}
      `),
    ]);

    // Extract scalar counts safely
    const toCount = (rows: unknown): number => {
      const r = rows as [{ count: number | string }[], unknown];
      return Number(r[0]?.[0]?.count ?? 0);
    };
    const toRows = (rows: unknown): { action: string; count: number }[] => {
      const r = rows as [{ action: string; count: number | string }[], unknown];
      return (r[0] ?? []).map(row => ({ action: row.action, count: Number(row.count) }));
    };
    const toDeletionInfo = (rows: unknown): { count: number; oldest: string | null } => {
      const r = rows as [{ count: number | string; oldest: string | null }[], unknown];
      return { count: Number(r[0]?.[0]?.count ?? 0), oldest: r[0]?.[0]?.oldest ?? null };
    };

    const deletionInfo = toDeletionInfo(deletionQueue);

    res.json({
      fetchedAt: now.toISOString(),
      auth: {
        eventsLast24h: toCount(authAudit),
      },
      roles: {
        changesLast7d: toRows(roleChanges),
      },
      deletion: {
        pendingCount: deletionInfo.count,
        oldestRequestedAt: deletionInfo.oldest,
      },
      blocks: {
        total: toCount(blocksTotal),
      },
      moderation: {
        openReports: toCount(reportsOpen),
        reportsLast7d: toCount(reportsTotal7d),
      },
      email: {
        optOutsLast30d: toCount(emailOptOuts),
      },
      sessions: {
        activeApprox: toCount(activeSessionsApprox),
      },
      accounts: {
        newLast24h: toCount(newAccounts24h),
        suspended: toCount(suspendedAccounts),
      },
      ownerSeed: {
        attemptsLast7d: toCount(ownerSeedAttempts),
        retired: true,
      },
    });
  } catch (err) {
    console.error('security dashboard error', err);
    res.status(500).json({ error: 'Failed to load security data' });
  }
}
