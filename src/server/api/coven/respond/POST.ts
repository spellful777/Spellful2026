import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { covenConnections } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const session = await getAuthSession(req);
    if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const { connectionId, action } = req.body as { connectionId: number; action: 'accept' | 'decline' };
    if (!connectionId || (action !== 'accept' && action !== 'decline')) return res.status(400).json({ error: 'connectionId and action required' });

    const status = action === 'accept' ? 'accepted' : 'declined';
    const ownedRequest = and(eq(covenConnections.id, connectionId), eq(covenConnections.receiverId, session.user.id));
    const [result] = await db.update(covenConnections)
      .set({ status })
      .where(and(ownedRequest, eq(covenConnections.status, 'pending')));
    if (!result.affectedRows) {
      const [confirmed] = await db.select({ id: covenConnections.id }).from(covenConnections)
        .where(and(ownedRequest, eq(covenConnections.status, status))).limit(1);
      if (!confirmed) return res.status(409).json({ error: 'Request is no longer pending' });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(JSON.stringify({ event: 'coven.respond.error', msg: String(err).slice(0, 120) }));
    res.status(500).json({ error: 'Failed to respond' });
  }
}