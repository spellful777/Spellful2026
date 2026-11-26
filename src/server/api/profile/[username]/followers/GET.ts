import type { Request, Response } from 'express';
import { or, eq, sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityBlocks, covenConnections, user } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { isBlocked } from '@/server/lib/block-check.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  res.set('Cache-Control', 'private, no-store');
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to view followers' });

  const viewer = session.user.id;
  const username = req.params.username.toLowerCase();
  const [owner] = await db.select({ id: user.id, visibility: user.profileVisibility, shareFollowers: user.shareFollowers })
    .from(user).where(or(eq(user.usernameNormalized, username), sql`(${user.usernameNormalized} is null and lower(${user.username}) = ${username})`)).limit(1);

  const unavailable = () => res.status(404).json({ error: 'Follower list unavailable' });
  if (!owner) return unavailable();
  if (owner.id !== viewer) {
    if (!owner.shareFollowers || (owner.visibility !== 'public' && owner.visibility !== 'coven')) return unavailable();
    if (await isBlocked(viewer, owner.id)) return unavailable();
    if (owner.visibility === 'coven') {
      const [connection] = await db.select({ id: covenConnections.id }).from(covenConnections)
        .where(acceptedConnection(viewer, sql`${owner.id}`)).limit(1);
      if (!connection) return unavailable();
    }
  }

  const after = typeof req.query.before === 'string' ? Number(req.query.before) : null;
  if (after !== null && (!Number.isSafeInteger(after) || after < 1)) {
    return res.status(400).json({ error: 'Invalid follower cursor' });
  }

  const [result] = await db.execute(sql`
    select user_follows.id as cursor, ${user.username} as username, ${user.name} as name
    from user_follows inner join ${user} on ${user.id} = user_follows.follower_id
    where user_follows.following_id = ${owner.id}
      and (${viewer} = ${owner.id} or exists (
        select 1 from ${user} as list_owner
        where list_owner.id = ${owner.id} and list_owner.share_followers = true
          and (list_owner.profile_visibility = 'public' or (
            list_owner.profile_visibility = 'coven' and exists (select 1 from ${covenConnections}
              where ${acceptedConnection(viewer, sql`list_owner.id`)})))
          and not exists (select 1 from ${communityBlocks}
            where (${communityBlocks.blockerId} = ${viewer} and ${communityBlocks.blockedId} = list_owner.id)
              or (${communityBlocks.blockedId} = ${viewer} and ${communityBlocks.blockerId} = list_owner.id))
      ))
      and ${user.username} is not null
      ${after === null ? sql`` : sql`and user_follows.id < ${after}`}
      and (${user.id} = ${viewer} or ${user.profileVisibility} = 'public' or (
        ${user.profileVisibility} = 'coven' and exists (select 1 from ${covenConnections}
          where ${acceptedConnection(viewer, sql`${user.id}`)})))
      and not exists (select 1 from ${communityBlocks}
        where (${communityBlocks.blockerId} = ${viewer} and ${communityBlocks.blockedId} = ${user.id})
          or (${communityBlocks.blockedId} = ${viewer} and ${communityBlocks.blockerId} = ${user.id}))
    order by user_follows.id desc limit 21
  `);
  const rows = result as unknown as { cursor: number; username: string; name: string }[];
  const followers = rows.slice(0, 20);
  res.json({
    followers: followers.map(({ username, name }) => ({ username, name })),
    next: rows.length > 20 ? followers.at(-1)?.cursor : null,
  });
}

function acceptedConnection(viewer: string, other: ReturnType<typeof sql>) {
  return sql`${covenConnections.status} = 'accepted' and (
    (${covenConnections.requesterId} = ${viewer} and ${covenConnections.receiverId} = ${other}) or
    (${covenConnections.receiverId} = ${viewer} and ${covenConnections.requesterId} = ${other})
  )`;
}
