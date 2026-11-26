import { selectRows } from '@/server/db/select-rows';
// GET /api/groups/:id/messages — fetch messages for a group conversation
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request<{ id: string }>, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;
  const groupId = parseInt(req.params.id, 10);
  if (isNaN(groupId)) { res.status(400).json({ error: 'Invalid group id' }); return; }

  // Verify membership
  const [membership] = await db.execute(sql`
    SELECT joined_at, history_visible_from FROM group_members
    WHERE group_id = ${groupId} AND user_id = ${userId} AND left_at IS NULL
  `);
  const memberRows = selectRows<{ joined_at: string; history_visible_from: string }>(membership);
  if (!memberRows.length) { res.status(403).json({ error: 'Not a member of this group' }); return; }

  const historyFrom = memberRows[0].history_visible_from;
  const before = req.query.before ? parseInt(req.query.before as string, 10) : null;
  const limit = 50;

  const [rows] = before
    ? await db.execute(sql`
        SELECT
          gm.id,
          gm.group_id AS groupId,
          gm.sender_id AS senderId,
          IF(gm.deleted_at IS NOT NULL, NULL, gm.content) AS content,
          gm.system_message AS systemMessage,
          gm.reply_to_id AS replyToId,
          gm.edited_at AS editedAt,
          gm.deleted_at AS deletedAt,
          gm.created_at AS createdAt,
          u.name AS senderName,
          u.image AS senderImage,
          u.username AS senderUsername
        FROM group_messages gm
        INNER JOIN user u ON u.id = gm.sender_id
        WHERE gm.group_id = ${groupId}
          AND gm.created_at >= ${historyFrom}
          AND gm.id < ${before}
        ORDER BY gm.id DESC
        LIMIT ${limit}
      `)
    : await db.execute(sql`
        SELECT
          gm.id,
          gm.group_id AS groupId,
          gm.sender_id AS senderId,
          IF(gm.deleted_at IS NOT NULL, NULL, gm.content) AS content,
          gm.system_message AS systemMessage,
          gm.reply_to_id AS replyToId,
          gm.edited_at AS editedAt,
          gm.deleted_at AS deletedAt,
          gm.created_at AS createdAt,
          u.name AS senderName,
          u.image AS senderImage,
          u.username AS senderUsername
        FROM group_messages gm
        INNER JOIN user u ON u.id = gm.sender_id
        WHERE gm.group_id = ${groupId}
          AND gm.created_at >= ${historyFrom}
        ORDER BY gm.id DESC
        LIMIT ${limit}
      `);

  const messages = (selectRows<Record<string, unknown>>(rows)).reverse();
  const hasMore = (selectRows<unknown>(rows)).length === limit;
  const oldestId = messages.length ? (messages[0] as { id: number }).id : null;

  res.json({ messages, hasMore, oldestId });
}
