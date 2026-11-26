import { and, inArray, sql } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityMutes, communityNotifications, communityPosts, user } from '@/server/db/schema.js';
import { visiblePostForMember } from './community-post-access.js';
import { getBlockedUserIds } from './block-check.js';

export async function notifyConversationReply({ postId, replyId, actor, owner, parent }: {
  postId: number; replyId: number; actor: string; owner: string; parent?: string;
}) {
  const blocked = await getBlockedUserIds(actor);
  const recipients = [...new Set([owner, ...(parent ? [parent] : [])])].filter(id => id !== actor && !blocked.has(id));
  if (!recipients.length) return [];
  const rows = await db.select({ id: user.id }).from(user)
    .innerJoin(communityPosts, visiblePostForMember(postId, user.id))
    .where(and(inArray(user.id, recipients),
      sql`coalesce(json_unquote(json_extract(${user.notificationPreferences}, '$.communityReplies')), 'true') <> 'false'`,
      sql`not exists (select 1 from ${communityMutes}
        where ${communityMutes.userId} = ${user.id} and ${communityMutes.postId} = ${postId})`));
  if (rows.length) await db.insert(communityNotifications).values(rows.map(row => ({
    userId: row.id, actorId: actor, postId, replyId,
    type: row.id === parent ? 'direct_reply' : 'reply',
    message: row.id === parent ? 'Replied directly to your comment.' : 'Someone replied to your post.',
  })));
  return rows.map(row => row.id);
}
