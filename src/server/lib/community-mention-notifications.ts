import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { communityMentionRecipients } from '@/lib/community-mentions';
import { db } from '@/server/db/client.js';
import { communityMutes, communityNotifications, communityPosts, user } from '@/server/db/schema.js';
import { getBlockedUserIds } from './block-check.js';
import { visiblePostForMember } from './community-post-access.js';

export async function notifyCommunityMentions({
  html, actorId, postId, replyId, alreadyNotified,
}: {
  html: string;
  actorId: string;
  postId: number;
  replyId?: number;
  alreadyNotified?: string | string[];
}) {
  const names = communityMentionRecipients(html);
  if (!names.length) return;

  const excluded = await getBlockedUserIds(actorId);
  excluded.add(actorId);
  for (const id of typeof alreadyNotified === 'string' ? [alreadyNotified] : alreadyNotified ?? []) excluded.add(id);
  const recipients = await db.select({ id: user.id }).from(user)
    .innerJoin(communityPosts, visiblePostForMember(postId, user.id))
    .where(and(
      inArray(user.usernameNormalized, names),
      eq(user.mentionsAllowed, true),
      replyId ? sql`coalesce(json_unquote(json_extract(${user.notificationPreferences}, '$.communityReplies')), 'true') <> 'false'` : undefined,
      notInArray(user.id, [...excluded]),
      sql`not exists (select 1 from ${communityMutes}
        where ${communityMutes.userId} = ${user.id} and ${communityMutes.postId} = ${postId})`,
    ));
  if (recipients.length) {
    await db.insert(communityNotifications).values(recipients.map(({ id }) => ({
      userId: id, type: 'mention', actorId, postId, replyId,
      message: replyId ? 'Mentioned you in a Coven reply.' : 'Mentioned you in a Coven post.',
    })));
  }
}
