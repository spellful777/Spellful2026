import { sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityMutes, communityNotifications, communityPosts, communityPostFollowers, communityReplies } from '@/server/db/schema.js';
import { visiblePostForMember } from './community-post-access.js';

export async function notifyCommunityFollowUp(postId: number, replyId: number, authorId: string) {
  // Keep reply notifications working when an older deployment lacks the follower table.
  const participants = sql`
    select ${communityReplies.userId} as member_id, 1 as replied
    from ${communityReplies}
    where ${communityReplies.postId} = ${postId} and ${communityReplies.isHidden} = false
  `;
  const followers = sql`
    select ${communityPostFollowers.userId} as member_id, 0 as replied
    from ${communityPostFollowers} where ${communityPostFollowers.postId} = ${postId}
  `;
  const member = sql`participants.member_id`;

  const insertNotifications = (source: typeof participants) => db.execute(sql`
    insert into ${communityNotifications} (user_id, type, actor_id, post_id, reply_id, message)
    select ${member}, 'follow_up', ${authorId}, ${postId}, ${replyId},
      case when max(participants.replied) = 1 then 'An update to a post you replied to'
        else 'An update to a conversation you follow' end
    from (${source}) as participants
    inner join ${communityPosts} on ${visiblePostForMember(postId, member)}
    where ${member} <> ${authorId}
      and not exists (select 1 from ${communityMutes}
        where ${communityMutes.userId} = ${member} and ${communityMutes.postId} = ${postId})
    group by ${member}
  `);

  try {
    await insertNotifications(sql`${participants} union all ${followers}`);
  } catch (error) {
    const cause = error instanceof Error ? error.cause ?? error : error;
    if (typeof cause !== 'object' || cause === null || !('code' in cause) || cause.code !== 'ER_NO_SUCH_TABLE') throw error;
    await insertNotifications(participants);
  }
}
