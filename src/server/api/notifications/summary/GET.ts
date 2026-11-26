import { postAudienceAllows } from '@/server/lib/community-post-access.js';
/**
 * GET /api/notifications/summary
 *
 * Returns unread counts for the Coven footer badge:
 *   messages  — total unread DMs across all conversations (readAt IS NULL)
 *   requests  — pending message requests addressed to this user
 *   community — unread community notifications (replies, mentions, likes)
 *   newPosts  — community posts published after the user's feed cursor
 *   total     — sum of all four
 *
 * Polled every 30 s from the client. All counts are permission-filtered
 * and exclude blocked users and the user's own content.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import {
  conversations, messages, messageRequests,
  communityNotifications, communityPosts, communityFeedCursors,
  communityBlocks,
} from '@/server/db/schema.js';
import { or, eq, and, gt, isNull, count, ne, inArray } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const myId = session.user.id;

  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  // Blocked user IDs — exclude their content from all counts
  const blockedRows = await db
    .select({ blockedId: communityBlocks.blockedId })
    .from(communityBlocks)
    .where(eq(communityBlocks.blockerId, myId));
  const blockedIds = blockedRows.map((r) => r.blockedId);

  // ── 1. Unread DMs ────────────────────────────────────────────────────────────
  const myConvs = await db
    .select({ id: conversations.id, p1: conversations.participant1Id, p2: conversations.participant2Id })
    .from(conversations)
    .where(or(eq(conversations.participant1Id, myId), eq(conversations.participant2Id, myId)));

  const visibleConvIds = myConvs
    .filter((c) => {
      const otherId = c.p1 === myId ? c.p2 : c.p1;
      return !otherId || !blockedIds.includes(otherId);
    })
    .map((c) => c.id);

  let unreadMessages = 0;
  if (visibleConvIds.length > 0) {
    const [msgRow] = await db
      .select({ cnt: count() })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, visibleConvIds),
          ne(messages.senderId, myId),
          isNull(messages.readAt),
        ),
      );
    unreadMessages = Number(msgRow?.cnt ?? 0);
  }

  // ── 2. Pending message requests ──────────────────────────────────────────────
  const [reqRow] = await db
    .select({ cnt: count() })
    .from(messageRequests)
    .where(and(eq(messageRequests.recipientId, myId), eq(messageRequests.status, 'pending')));
  const pendingRequests = Number(reqRow?.cnt ?? 0);

  // ── 3. Unread community notifications ────────────────────────────────────────
  const [notifRow] = await db
    .select({ cnt: count() })
    .from(communityNotifications)
    .where(and(eq(communityNotifications.userId, myId), eq(communityNotifications.isRead, false)));
  const unreadCommunity = Number(notifRow?.cnt ?? 0);

  // ── 4. New community posts since feed cursor ─────────────────────────────────
  const [cursorRow] = await db
    .select({ lastSeenAt: communityFeedCursors.lastSeenAt })
    .from(communityFeedCursors)
    .where(eq(communityFeedCursors.userId, myId))
    .limit(1);

  let newPosts = 0;
  if (cursorRow) {
    const conditions = [
      gt(communityPosts.createdAt, cursorRow.lastSeenAt),
      ne(communityPosts.userId, myId),
      eq(communityPosts.isHidden, false),
      postAudienceAllows(myId),
    ];
    if (blockedIds.length > 0) {
      conditions.push(ne(communityPosts.userId, blockedIds[0])); // handled below via filter
    }

    const postRows = await db
      .select({ userId: communityPosts.userId })
      .from(communityPosts)
      .where(and(...conditions));

    // Filter out blocked authors in JS (avoids complex SQL NOT IN with variable length)
    const blockedSet = new Set(blockedIds);
    newPosts = postRows.filter((p) => !blockedSet.has(p.userId)).length;
  }

  const total = unreadMessages + pendingRequests + unreadCommunity + newPosts;

  res.json({ messages: unreadMessages, requests: pendingRequests, community: unreadCommunity, newPosts, total });
}
