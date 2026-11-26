import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityMutes, communityNotifications, communityPosts, communityReplies } from '@/server/db/schema.js';
import { visiblePostForMember } from './community-post-access.js';

export async function notifyCommunityFollowUp(postId: number, replyId: number, authorId: string) {
  const participant = communityReplies.userId;

  await db.execute(sql`
    insert into ${communityNotifications} (user_id, type, actor_id, post_id, reply_id, message)
    select distinct ${participant}, 'follow_up', ${authorId}, ${postId}, ${replyId},
      'An update to a post you replied to'
    from ${communityReplies}
    inner join ${communityPosts} on ${visiblePostForMember(postId, participant)}
    where ${communityReplies.postId} = ${postId}
      and ${communityReplies.isHidden} = false
      and ${participant} <> ${authorId}
      and not exists (select 1 from ${communityMutes}
        where ${communityMutes.userId} = ${participant} and ${communityMutes.postId} = ${postId})
  `);
}
