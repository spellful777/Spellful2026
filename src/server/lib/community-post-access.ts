import { and, eq, sql, type SQLWrapper } from 'drizzle-orm';
import { communityBlocks, communityFollows, communityPosts, covenConnections } from '@/server/db/schema.js';

export function followsPostAuthor(viewer: string) {
  return sql`exists (select 1 from ${communityFollows}
    where ${communityFollows.followerId} = ${viewer}
      and ${communityFollows.followingId} = ${communityPosts.userId})`;
}

// The caller separately decides whether a moderated post can be viewed by its author.
export function postAudienceAllows(viewer?: string | SQLWrapper) {
  const publicPost = sql`${communityPosts.audience} = 'public'`;
  if (!viewer) return publicPost;

  const author = communityPosts.userId;
  const block = communityBlocks;
  const connection = covenConnections;
  return sql`(not exists (select 1 from ${block} where
    (${block.blockerId} = ${viewer} and ${block.blockedId} = ${author}) or
    (${block.blockedId} = ${viewer} and ${block.blockerId} = ${author}))
    and (${publicPost} or ${author} = ${viewer} or
      (${communityPosts.audience} = 'coven' and exists (select 1 from ${connection}
        where ${connection.status} = 'accepted' and
          ((${connection.requesterId} = ${viewer} and ${connection.receiverId} = ${author}) or
           (${connection.receiverId} = ${viewer} and ${connection.requesterId} = ${author}))))))`;
}

export function visiblePostForMember(postId: number, viewer: string | SQLWrapper) {
  return and(eq(communityPosts.id, postId), eq(communityPosts.isHidden, false), postAudienceAllows(viewer));
}
