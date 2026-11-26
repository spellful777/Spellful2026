import { selectRows } from '@/server/db/select-rows';
// GET /api/groups — list group conversations the current user is a member of
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;

  const [rows] = await db.execute(sql`
    SELECT
      gc.id,
      gc.name,
      gc.description,
      gc.avatar_url AS avatarUrl,
      gc.created_by AS createdBy,
      gc.history_policy AS historyPolicy,
      gc.created_at AS createdAt,
      gc.updated_at AS updatedAt,
      gm.role,
      gm.joined_at AS joinedAt,
      COALESCE(gus.is_archived, 0) AS isArchived,
      COALESCE(gus.is_pinned, 0) AS isPinned,
      COALESCE(gus.is_muted, 0) AS isMuted,
      (
        SELECT COUNT(*) FROM group_members gm2
        WHERE gm2.group_id = gc.id AND gm2.left_at IS NULL
      ) AS memberCount,
      (
        SELECT lm.content
        FROM group_messages lm
        WHERE lm.group_id = gc.id AND lm.deleted_at IS NULL
        ORDER BY lm.created_at DESC
        LIMIT 1
      ) AS lastMessageContent,
      (
        SELECT lm.created_at
        FROM group_messages lm
        WHERE lm.group_id = gc.id AND lm.deleted_at IS NULL
        ORDER BY lm.created_at DESC
        LIMIT 1
      ) AS lastMessageAt,
      (
        SELECT COUNT(*) FROM group_messages unread
        WHERE unread.group_id = gc.id
          AND unread.sender_id != ${userId}
          AND unread.deleted_at IS NULL
          AND unread.created_at > COALESCE(gm.joined_at, '1970-01-01')
      ) AS unreadCount
    FROM group_conversations gc
    INNER JOIN group_members gm ON gm.group_id = gc.id AND gm.user_id = ${userId} AND gm.left_at IS NULL
    LEFT JOIN group_user_state gus ON gus.group_id = gc.id AND gus.user_id = ${userId}
    ORDER BY gc.updated_at DESC
  `);

  const groups = (selectRows<Record<string, unknown>>(rows)).map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    avatarUrl: r.avatarUrl,
    createdBy: r.createdBy,
    historyPolicy: r.historyPolicy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    role: r.role,
    joinedAt: r.joinedAt,
    isArchived: Boolean(r.isArchived),
    isPinned: Boolean(r.isPinned),
    isMuted: Boolean(r.isMuted),
    memberCount: Number(r.memberCount ?? 0),
    unreadCount: Number(r.unreadCount ?? 0),
    lastMessage: r.lastMessageContent ? { content: r.lastMessageContent, createdAt: r.lastMessageAt } : null,
  }));

  res.json({ groups });
}
