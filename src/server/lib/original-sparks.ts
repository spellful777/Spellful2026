import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPosts, user } from '@/server/db/schema.js';
import { postAudienceAllows } from './community-post-access.js';
import type { OriginalSpark } from '@/lib/spark-media';

export async function loadOriginalSparks(ids: (number | null)[], viewer?: string) {
  const wanted = [...new Set(ids.filter((id): id is number => id !== null))];
  const originals = new Map<number, OriginalSpark>();
  if (!wanted.length) return originals;
  const rows = await db.select({
    id: communityPosts.id,
    title: communityPosts.title,
    authorName: user.name,
    sparkMedia: communityPosts.sparkMedia, sparkTopic: communityPosts.sparkTopic, sparkReading: communityPosts.sparkReading,
    imageUrl: communityPosts.imageUrl,
  }).from(communityPosts).leftJoin(user, eq(communityPosts.userId, user.id))
    .where(and(inArray(communityPosts.id, wanted), eq(communityPosts.type, 'spark'),
      eq(communityPosts.isHidden, false), eq(communityPosts.audience, 'public'), postAudienceAllows(viewer)));
  for (const row of rows) originals.set(row.id, row);
  return originals;
}
