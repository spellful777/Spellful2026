import { selectRows } from '@/server/db/select-rows';
/**
 * PATCH /api/admin/messaging/config
 * Update platform-level messaging configuration.
 * Requires owner role (not just admin — config changes are high-impact).
 * Records change in audit_events.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { auditEvents } from '@/server/db/schema.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'owner')) {
    return res.status(403).json({ error: 'Forbidden — owner only' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const patch = req.body as Record<string, unknown>;
  if (!patch || typeof patch !== 'object') {
    return res.status(400).json({ error: 'Invalid body' });
  }

  // Fetch current config
  const row = await db.execute(sql`
    SELECT value FROM platform_settings WHERE key_name = 'messaging_config' LIMIT 1
  `);
  type SettingsRow = { value: string };
  const existing = ((selectRows<SettingsRow>(row[0]))[0]);
  const current = existing ? (JSON.parse(existing.value) as Record<string, unknown>) : {};

  const updated = { ...current, ...patch };

  // Upsert
  await db.execute(sql`
    INSERT INTO platform_settings (key_name, value, updated_at)
    VALUES ('messaging_config', ${JSON.stringify(updated)}, NOW())
    ON DUPLICATE KEY UPDATE value = ${JSON.stringify(updated)}, updated_at = NOW()
  `);

  // Audit
  await db.insert(auditEvents).values({
    actorId:  session.user.id,
    targetId: session.user.id,
    action:   'messaging_config_update',
    oldValue: JSON.stringify(current).slice(0, 500),
    newValue: JSON.stringify(updated).slice(0, 500),
    reason:   'Messaging config updated via admin console',
  });

  return res.json({ ok: true, config: updated });
}
