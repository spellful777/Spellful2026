/**
 * PATCH /api/admin/community/announcements/:id
 * Update an announcement. Requires admin role.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityAnnouncements } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid id' });

  const { type, title, body, isPinned, isPublished, scheduledFor } = req.body as {
    type?: string; title?: string; body?: string;
    isPinned?: boolean; isPublished?: boolean; scheduledFor?: string;
  };

  const updates: Record<string, unknown> = {};
  if (type !== undefined) updates.type = type;
  if (title !== undefined) updates.title = title.slice(0, 255);
  if (body !== undefined) updates.body = body;
  if (isPinned !== undefined) updates.isPinned = isPinned;
  if (isPublished !== undefined) {
    updates.isPublished = isPublished;
    if (isPublished) updates.publishedAt = new Date();
  }
  if (scheduledFor !== undefined) updates.scheduledFor = scheduledFor ? new Date(scheduledFor) : null;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  await db.update(communityAnnouncements).set(updates).where(eq(communityAnnouncements.id, id));
  return res.json({ ok: true });
}
