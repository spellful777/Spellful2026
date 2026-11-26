import { and, eq, inArray, lte, sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPosts, communityLikes, communityBlocks, covenConnections, user } from '@/server/db/schema.js';

export async function communityLikePreviews(kind: 'post' | 'reply', targets: number[], viewer: string) {
  const result = new Map<number, string[]>();
  if (!targets.length) return result;
  const eligible = db.$with('eligible_likes').as(db.select({
    id: communityLikes.targetId,
    name: sql<string>`coalesce(nullif(${user.name}, ''), ${user.username}, 'Coven member')`.as('display_name'),
    rank: sql<number>`row_number() over (partition by ${communityLikes.targetId}
      order by ${communityLikes.createdAt} desc, ${communityLikes.id} desc)`.as('like_rank'),
  }).from(communityLikes).innerJoin(user, eq(user.id, communityLikes.userId))
    .where(and(eq(communityLikes.targetType, kind), inArray(communityLikes.targetId, targets),
      eq(user.shareLikesWithCoven, true),
      kind === 'post' ? sql`exists (select 1 from ${communityPosts}
        where ${communityPosts.id} = ${communityLikes.targetId} and ${communityPosts.type} <> 'spark')` : undefined,
      sql`exists (select 1 from ${covenConnections} where ${covenConnections.status} = 'accepted' and
        ((${covenConnections.requesterId} = ${viewer} and ${covenConnections.receiverId} = ${user.id}) or
         (${covenConnections.receiverId} = ${viewer} and ${covenConnections.requesterId} = ${user.id})))`,
      sql`not exists (select 1 from ${communityBlocks} where
        ((${communityBlocks.blockerId} = ${viewer} and ${communityBlocks.blockedId} = ${user.id}) or
         (${communityBlocks.blockedId} = ${viewer} and ${communityBlocks.blockerId} = ${user.id})))`
    )));
  const rows = await db.with(eligible).select().from(eligible).where(lte(eligible.rank, 3)).orderBy(eligible.rank);
  for (const row of rows) result.set(row.id, [...(result.get(row.id) ?? []), row.name]);
  return result;
}
