import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';

export async function circleAccess(circleId: number, viewerId: string) {
  const [rows] = await db.execute(sql`
    select c.id, c.rules, c.welcome_post_id as welcomePostId,
      (m.role in ('owner','admin','moderator') or coalesce(${user.isAdmin}, false)) as canModerate
    from spellful_circles c
    inner join circle_memberships m on m.circle_id = c.id and m.user_id = ${viewerId} and m.status = 'active'
    inner join ${user} on ${user.id} = m.user_id
    where c.id = ${circleId} limit 1
  `);
  return (rows as unknown as { id: number; rules: string | null; welcomePostId: number | null; canModerate: number }[])[0];
}
