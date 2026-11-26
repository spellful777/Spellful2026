import type { Request, Response } from 'express';
import { and, desc, eq, isNotNull, or, sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { covenConnections, communityBlocks, user } from '@/server/db/schema.js';
import { findTopic } from '@/lib/spark-topics';
import { getAuthSession } from './auth-session.js';

export async function topicMembers(req: Request<{ topic: string }>, res: Response) {
  const topic = findTopic(req.params.topic);
  if (!topic) return res.sendStatus(404);
  const viewer = (await getAuthSession(req))?.user?.id;
  const members = await db.select({ username: user.username, name: user.name, image: user.image }).from(user)
    .where(and(eq(user.discoverable, true), isNotNull(user.username),
      sql`json_search(lower(cast(${user.interestTags} as char)), 'one', ${topic.toLowerCase()}) is not null`,
      sql`(${user.profileSections} is null or not json_contains(${user.profileSections}, ${JSON.stringify({ id: 'interests', enabled: false })}))`,
      or(eq(user.profileVisibility, 'public'), viewer ? and(eq(user.profileVisibility, 'coven'), sql`exists (
        select 1 from ${covenConnections} where ${covenConnections.status} = 'accepted' and
        ((${covenConnections.requesterId} = ${viewer} and ${covenConnections.receiverId} = ${user.id}) or
        (${covenConnections.receiverId} = ${viewer} and ${covenConnections.requesterId} = ${user.id})))`) : undefined),
      viewer ? sql`not exists (select 1 from ${communityBlocks} where
        ((${communityBlocks.blockerId} = ${viewer} and ${communityBlocks.blockedId} = ${user.id}) or
        (${communityBlocks.blockedId} = ${viewer} and ${communityBlocks.blockerId} = ${user.id})))` : undefined))
    .orderBy(desc(user.createdAt), desc(user.id)).limit(36);
  res.setHeader('Cache-Control', 'private, no-store');
  return res.json({ members });
}
