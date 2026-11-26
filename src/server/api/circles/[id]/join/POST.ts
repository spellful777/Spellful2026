/**
 * POST /api/circles/:id/join
 * Join or leave a Spellful Circle (toggle).
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const myId = session.user.id;

  const circleId = Number(req.params.id);
  if (!Number.isSafeInteger(circleId) || circleId < 1) return res.status(400).json({ error: 'Invalid circle id' });

  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  try {
    const outcome = await db.transaction(async tx => {
      const [circleRows] = await tx.execute(sql`
        select membership_type from spellful_circles where id = ${circleId} limit 1 for update
      `);
      const circle = (circleRows as unknown as { membership_type: string }[])[0];
      if (!circle) return { status: 404, error: 'Circle unavailable' };

      const [memberRows] = await tx.execute(sql`
        select status from circle_memberships where circle_id = ${circleId} and user_id = ${myId} limit 1
      `);
      const member = (memberRows as unknown as { status: string }[])[0];
      if (member?.status === 'active') {
        await tx.execute(sql`delete from circle_memberships where circle_id = ${circleId} and user_id = ${myId}`);
        await tx.execute(sql`update spellful_circles set member_count = greatest(0, member_count - 1) where id = ${circleId}`);
        return { status: 200, joined: false };
      }
      if (member || circle.membership_type !== 'open') {
        return { status: 403, error: 'An invitation is required for this Circle' };
      }
      await tx.execute(sql`
        insert into circle_memberships (circle_id, user_id, role, status) values (${circleId}, ${myId}, 'member', 'active')
      `);
      await tx.execute(sql`update spellful_circles set member_count = member_count + 1 where id = ${circleId}`);
      return { status: 200, joined: true };
    });
    return res.status(outcome.status).json(outcome.error ? { error: outcome.error } : { joined: outcome.joined });
  } catch {
    res.status(503).json({ error: 'Circles feature not yet available' });
  }
}
