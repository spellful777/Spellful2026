import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { covenConnections } from '@/server/db/schema.js';
import { eq, and, or } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { isBlocked } from '@/server/lib/block-check.js';

export default async function handler(req: Request, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const session = await getAuthSession(req);
    if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const { receiverId } = req.body as { receiverId: string };
    if (!receiverId) return res.status(400).json({ error: 'receiverId required' });
    if (receiverId === session.user.id) return res.status(400).json({ error: 'Cannot connect with yourself' });

    // Prevent invitations between blocked accounts — fail closed if DB unavailable
    try {
      if (await isBlocked(session.user.id, receiverId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } catch {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    const [existing] = await db.select().from(covenConnections).where(
      or(
        and(eq(covenConnections.requesterId, session.user.id), eq(covenConnections.receiverId, receiverId)),
        and(eq(covenConnections.requesterId, receiverId), eq(covenConnections.receiverId, session.user.id))
      )
    ).limit(1);

    if (existing) return res.status(409).json({ error: 'Connection already exists', status: existing.status });

    const [result] = await db.insert(covenConnections).values({
      requesterId: session.user.id,
      receiverId,
      status: 'pending',
    });

    res.status(201).json({ ok: true, connectionId: result.insertId });
  } catch (err) {
    console.error(JSON.stringify({ event: 'coven.request.error', msg: String(err).slice(0, 120) }));
    res.status(500).json({ error: 'Failed to send request' });
  }
}