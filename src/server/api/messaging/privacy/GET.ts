import { selectRows } from '@/server/db/select-rows';
// GET /api/messaging/privacy — get the current user's messaging privacy settings
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

const DEFAULTS = {
  whoCanMessage: 'everyone',
  presenceVisibility: 'everyone',
  showTypingIndicators: true,
  showReadReceipts: true,
  groupInvitePermission: 'everyone',
  allowVoiceMessages: true,
  notificationPreview: true,
};

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;

  const [rows] = await db.execute(sql`
    SELECT * FROM messaging_privacy_settings WHERE user_id = ${userId}
  `);
  const r = (selectRows<Record<string, unknown>>(rows))[0];

  if (!r) {
    res.json({ settings: DEFAULTS });
    return;
  }

  res.json({
    settings: {
      whoCanMessage: r.who_can_message ?? DEFAULTS.whoCanMessage,
      presenceVisibility: r.presence_visibility ?? DEFAULTS.presenceVisibility,
      showTypingIndicators: Boolean(r.show_typing_indicators ?? DEFAULTS.showTypingIndicators),
      showReadReceipts: Boolean(r.show_read_receipts ?? DEFAULTS.showReadReceipts),
      groupInvitePermission: r.group_invite_permission ?? DEFAULTS.groupInvitePermission,
      allowVoiceMessages: Boolean(r.allow_voice_messages ?? DEFAULTS.allowVoiceMessages),
      notificationPreview: Boolean(r.notification_preview ?? DEFAULTS.notificationPreview),
    },
  });
}
