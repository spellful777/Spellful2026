// PUT /api/messaging/drafts — save or clear a draft for a conversation or group
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;

  const { conversationId, groupId, content } = req.body as {
    conversationId?: number;
    groupId?: number;
    content?: string;
  };

  if (!conversationId && !groupId) {
    res.status(400).json({ error: 'conversationId or groupId is required' }); return;
  }

  if (!content?.trim()) {
    // Clear draft
    if (conversationId) {
      await db.execute(sql`
        DELETE FROM conversation_drafts WHERE user_id = ${userId} AND conversation_id = ${conversationId}
      `);
    } else {
      await db.execute(sql`
        DELETE FROM conversation_drafts WHERE user_id = ${userId} AND group_id = ${groupId}
      `);
    }
    res.json({ ok: true, cleared: true });
    return;
  }

  if (content.length > 4000) {
    res.status(400).json({ error: 'Draft too long' }); return;
  }

  if (conversationId) {
    await db.execute(sql`
      INSERT INTO conversation_drafts (user_id, conversation_id, content)
      VALUES (${userId}, ${conversationId}, ${content})
      ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()
    `);
  } else {
    await db.execute(sql`
      INSERT INTO conversation_drafts (user_id, group_id, content)
      VALUES (${userId}, ${groupId}, ${content})
      ON DUPLICATE KEY UPDATE content = VALUES(content), updated_at = NOW()
    `);
  }

  res.json({ ok: true });
}
