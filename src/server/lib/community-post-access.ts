import { and, eq, sql, type SQLWrapper } from 'drizzle-orm';
import { communityBlocks, userFollows, communityPosts, covenConnections } from '@/server/db/schema.js';

export function followsPostAuthor(viewer: string) {
  return sql`exists (select 1 from ${userFollows}
    where ${userFollows.followerId} = ${viewer}
      and ${userFollows.followingId} = ${communityPosts.userId})`;
}

export function covenWithPostAuthor(viewer: string | SQLWrapper) {
  const author = communityPosts.userId;
  return sql`exists (select 1 from ${covenConnections}
    where ${covenConnections.status} = 'accepted' and
      ((${covenConnections.requesterId} = ${viewer} and ${covenConnections.receiverId} = ${author}) or
       (${covenConnections.receiverId} = ${viewer} and ${covenConnections.requesterId} = ${author})))`;
}

// The caller separately decides whether a moderated post can be viewed by its author.
export function postAudienceAllows(viewer?: string | SQLWrapper) {
  const publicPost = sql`${communityPosts.audience} = 'public'`;
  if (!viewer) return publicPost;

  const author = communityPosts.userId;
  const block = communityBlocks;
  return sql`(not exists (select 1 from ${block} where
    (${block.blockerId} = ${viewer} and ${block.blockedId} = ${author}) or
    (${block.blockedId} = ${viewer} and ${block.blockerId} = ${author}))
    and (${publicPost} or ${author} = ${viewer} or
      (${communityPosts.audience} = 'coven' and ${covenWithPostAuthor(viewer)})))`;
}

export function visiblePostForMember(postId: number, viewer: string | SQLWrapper) {
  return and(eq(communityPosts.id, postId), eq(communityPosts.isHidden, false), postAudienceAllows(viewer));
}
