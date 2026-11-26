import { selectRows } from '@/server/db/select-rows';
/**
 * GET /api/admin/messaging/config
 * Returns platform-level messaging configuration.
 * Requires admin or owner role.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

// Default config — returned when no row exists yet
const DEFAULT_CONFIG = {
  maxMessageLength:          2000,
  maxAttachmentSizeMb:       10,
  allowedAttachmentTypes:    ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxGroupSize:              50,
  maxGroupsPerUser:          20,
  dmEnabled:                 true,
  groupsEnabled:             true,
  richCardsEnabled:          true,
  pushNotificationsEnabled:  true,
  // Role-based restrictions: roles that are blocked from messaging
  blockedRoles:              [] as string[],
  // Minimum account age in days before messaging is allowed (0 = no restriction)
  minAccountAgeDays:         0,
  updatedAt:                 null as string | null,
};

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  // Config is stored as a JSON blob in platform_settings
  const row = await db.execute(sql`
    SELECT value, updated_at FROM platform_settings WHERE key_name = 'messaging_config' LIMIT 1
  `);
  type SettingsRow = { value: string; updated_at: string | null };
  const settingsRow = ((selectRows<SettingsRow>(row[0]))[0]);

  if (!settingsRow) {
    return res.json(DEFAULT_CONFIG);
  }

  try {
    const parsed = JSON.parse(settingsRow.value) as typeof DEFAULT_CONFIG;
    return res.json({ ...DEFAULT_CONFIG, ...parsed, updatedAt: settingsRow.updated_at });
  } catch {
    return res.json(DEFAULT_CONFIG);
  }
}
