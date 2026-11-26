import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { covenConnections, user } from '@/server/db/schema.js';
import { eq, and, inArray, or } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { isBlocked } from '@/server/lib/block-check.js';

export default async function handler(req: Request, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const session = await getAuthSession(req);
    if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const requesterId = session.user.id;
    const { receiverId } = req.body as { receiverId: string };
    if (typeof receiverId !== 'string' || !receiverId) return res.status(400).json({ error: 'receiverId required' });
    if (receiverId === requesterId) return res.status(400).json({ error: 'Cannot connect with yourself' });

    // Prevent invitations between blocked accounts — fail closed if DB unavailable
    try {
      if (await isBlocked(session.user.id, receiverId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    } catch {
      return res.status(503).json({ error: 'Service temporarily unavailable' });
    }

    const result = await db.transaction(async (tx) => {
      // Serialize requests between the same two members, including simultaneous requests in opposite directions.
      const members = await tx.select({ id: user.id, invitePermission: user.invitePermission })
        .from(user).where(inArray(user.id, [requesterId, receiverId])).orderBy(user.id).for('update');
      const recipient = members.find(member => member.id === receiverId);
      if (!recipient || recipient.invitePermission === 'nobody') return { status: 403 as const };

      const [existing] = await tx.select({ status: covenConnections.status }).from(covenConnections).where(
        or(
          and(eq(covenConnections.requesterId, requesterId), eq(covenConnections.receiverId, receiverId)),
          and(eq(covenConnections.requesterId, receiverId), eq(covenConnections.receiverId, requesterId))
        )
      ).limit(1);
      if (existing) return { status: 409 as const, connectionStatus: existing.status };

      const [connection] = await tx.insert(covenConnections).values({ requesterId, receiverId, status: 'pending' }).$returningId();
      return { status: 201 as const, connectionId: connection.id };
    });

    if (result.status === 403) return res.status(403).json({ error: 'This member isn’t accepting Coven requests' });
    if (result.status === 409) return res.status(409).json({ error: 'Connection already exists', status: result.connectionStatus });
    return res.status(201).json({ ok: true, connectionId: result.connectionId });
  } catch (err) {
    console.error(JSON.stringify({ event: 'coven.request.error', msg: String(err).slice(0, 120) }));
    res.status(500).json({ error: 'Failed to send request' });
  }
}