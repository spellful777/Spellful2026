// PATCH /api/messaging/privacy — update messaging privacy settings
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';

const VALID_WHO_CAN_MESSAGE = ['everyone', 'requests', 'connections', 'nobody'];
const VALID_PRESENCE = ['everyone', 'connections', 'nobody'];
const VALID_GROUP_INVITE = ['everyone', 'connections', 'nobody'];

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }
  const userId = session.user.id;

  const {
    whoCanMessage,
    presenceVisibility,
    showTypingIndicators,
    showReadReceipts,
    groupInvitePermission,
    allowVoiceMessages,
    notificationPreview,
  } = req.body as Record<string, unknown>;

  if (whoCanMessage !== undefined && !VALID_WHO_CAN_MESSAGE.includes(whoCanMessage as string)) {
    res.status(400).json({ error: 'Invalid whoCanMessage value' }); return;
  }
  if (presenceVisibility !== undefined && !VALID_PRESENCE.includes(presenceVisibility as string)) {
    res.status(400).json({ error: 'Invalid presenceVisibility value' }); return;
  }
  if (groupInvitePermission !== undefined && !VALID_GROUP_INVITE.includes(groupInvitePermission as string)) {
    res.status(400).json({ error: 'Invalid groupInvitePermission value' }); return;
  }

  const wcm = (whoCanMessage as string | undefined) ?? 'everyone';
  const pv = (presenceVisibility as string | undefined) ?? 'everyone';
  const sti = showTypingIndicators !== undefined ? (showTypingIndicators ? 1 : 0) : 1;
  const srr = showReadReceipts !== undefined ? (showReadReceipts ? 1 : 0) : 1;
  const gip = (groupInvitePermission as string | undefined) ?? 'everyone';
  const avm = allowVoiceMessages !== undefined ? (allowVoiceMessages ? 1 : 0) : 1;
  const np = notificationPreview !== undefined ? (notificationPreview ? 1 : 0) : 1;

  await db.execute(sql`
    INSERT INTO messaging_privacy_settings
      (user_id, who_can_message, presence_visibility, show_typing_indicators,
       show_read_receipts, group_invite_permission, allow_voice_messages, notification_preview)
    VALUES (${userId}, ${wcm}, ${pv}, ${sti}, ${srr}, ${gip}, ${avm}, ${np})
    ON DUPLICATE KEY UPDATE
      who_can_message = VALUES(who_can_message),
      presence_visibility = VALUES(presence_visibility),
      show_typing_indicators = VALUES(show_typing_indicators),
      show_read_receipts = VALUES(show_read_receipts),
      group_invite_permission = VALUES(group_invite_permission),
      allow_voice_messages = VALUES(allow_voice_messages),
      notification_preview = VALUES(notification_preview),
      updated_at = NOW()
  `);

  res.json({ ok: true });
}
