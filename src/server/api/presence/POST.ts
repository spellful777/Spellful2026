import { selectRows } from '@/server/db/select-rows';
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { fanoutToUser } from '@/server/lib/sse-registry.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const userId = session.user.id;

  await db.execute(sql`
    INSERT INTO user_presence (user_id, last_seen)
    VALUES (${userId}, NOW())
    ON DUPLICATE KEY UPDATE last_seen = NOW()
  `);

  // SSE fanout — notify conversation partners of presence update
  // Find all accepted conversation partners to push to
  const [partnerRows] = await db.execute(sql`
    SELECT
      CASE WHEN participant1_id = ${userId} THEN participant2_id ELSE participant1_id END AS partner_id
    FROM conversations
    WHERE (participant1_id = ${userId} OR participant2_id = ${userId})
    LIMIT 50
  `);
  const partnerIds = (selectRows<{ partner_id: string | null }>(partnerRows))
    .map(r => r.partner_id)
    .filter((id): id is string => !!id);

  for (const partnerId of partnerIds) {
    fanoutToUser(partnerId, {
      type: 'presence_update',
      payload: { userId, online: true },
    });
  }

  res.json({ ok: true });
}
