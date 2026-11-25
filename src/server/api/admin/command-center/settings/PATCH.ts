/**
 * PATCH /api/admin/command-center/settings
 * Owner-only: update platform config toggles.
 * Body: Partial<PlatformConfig>
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole, writeAuditEvent } from '@/server/lib/require-role.js';
import { readConfig } from './GET.js';
import type { PlatformConfig } from './GET.js';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = path.resolve('/private/spellful-platform-config.json');

const BOOLEAN_KEYS: (keyof PlatformConfig)[] = [
  'registrationOpen',
  'requireEmailVerification',
  'plusEnabled',
  'communityEnabled',
  'messagingEnabled',
  'maintenanceMode',
];

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const actorId = session.user.id as string;
  const body = req.body as Partial<Record<string, unknown>>;

  // Only accept known boolean keys
  const current = await readConfig();
  const updates: Partial<PlatformConfig> = {};
  for (const key of BOOLEAN_KEYS) {
    if (key in body && typeof body[key] === 'boolean') {
      updates[key] = body[key] as boolean;
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid config keys provided' });
  }

  const next: PlatformConfig = { ...current, ...updates };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(next, null, 2), 'utf-8');
  await writeAuditEvent(actorId, 'update-platform-config', 'config', JSON.stringify(updates));

  return res.json({ ok: true, config: next });
}
