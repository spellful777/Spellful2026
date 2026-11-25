/**
 * POST /api/presence/batch
 * Returns online status for multiple user IDs in one request.
 * Body: { userIds: string[] }
 * Respects hideOnlineStatus and block rules for the requesting user.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { userPresence, user } from '@/server/db/schema.js';
import { inArray } from 'drizzle-orm';
import { getBlockedUserIds } from '@/server/lib/block-check.js';

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const myId = session.user.id;

  const { userIds } = req.body as { userIds?: unknown };
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return res.json({ presence: {} });
  }

  // Sanitise: strings only, max 100
  const ids = (userIds as unknown[])
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .slice(0, 100);

  if (!ids.length) return res.json({ presence: {} });

  // Get blocked set — treat blocked users as offline; fail closed if DB unavailable
  let blockedSet: Set<string>;
  try {
    blockedSet = await getBlockedUserIds(myId);
  } catch {
    return res.status(503).json({ error: 'Service temporarily unavailable' });
  }

  // Fetch hideOnlineStatus for all requested users
  let hiddenSet = new Set<string>();
  try {
    const hideRows = await db
      .select({ id: user.id, hideOnlineStatus: user.hideOnlineStatus })
      .from(user)
      .where(inArray(user.id, ids));
    hiddenSet = new Set(hideRows.filter(r => r.hideOnlineStatus).map(r => r.id));
  } catch { /* column may not exist yet — degrade gracefully */ }

  // Fetch presence rows
  const presenceRows = await db
    .select({ userId: userPresence.userId, lastSeen: userPresence.lastSeen })
    .from(userPresence)
    .where(inArray(userPresence.userId, ids));

  const presenceByUserId = new Map(presenceRows.map(r => [r.userId, r.lastSeen]));

  const result: Record<string, { online: boolean; lastSeen: string | null }> = {};
  for (const id of ids) {
    if (id === myId || blockedSet.has(id) || hiddenSet.has(id)) {
      result[id] = { online: false, lastSeen: null };
      continue;
    }
    const lastSeen = presenceByUserId.get(id) ?? null;
    const online = lastSeen ? Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS : false;
    result[id] = { online, lastSeen: lastSeen ? String(lastSeen) : null };
  }

  res.json({ presence: result });
}
