import { and, count, eq, inArray, max, sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPosts } from '@/server/db/schema.js';

export async function sparkReshares(ids: number[], viewer?: string) {
  const result = new Map<number, { reshareCount: number; reshared: boolean }>();
  if (ids.length) {
    const rows = await db.select({ source: communityPosts.reshareOf, n: count(),
      own: max(sql<number>`case when ${communityPosts.userId} = ${viewer ?? ''} then 1 else 0 end`),
    }).from(communityPosts).where(and(inArray(communityPosts.reshareOf, ids), eq(communityPosts.isHidden, false)))
      .groupBy(communityPosts.reshareOf);
    for (const row of rows) if (row.source) result.set(row.source, { reshareCount: row.n, reshared: Number(row.own) === 1 });
  }
  return result;
}
