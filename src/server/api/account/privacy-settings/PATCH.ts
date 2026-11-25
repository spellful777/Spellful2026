/**
 * PATCH /api/account/privacy-settings
 * Updates the authenticated member's privacy settings.
 * Only the fields listed in ALLOWED_FIELDS can be changed.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

type VisibilityLevel = 'public' | 'coven' | 'private';
type MessagePermission = 'everyone' | 'coven' | 'nobody';

interface PrivacyUpdate {
  profileVisibility?: VisibilityLevel;
  discoverable?: boolean;
  searchIndexed?: boolean;
  hideOnlineStatus?: boolean;
  messagePermission?: MessagePermission;
  birthdayVisibility?: VisibilityLevel;
  shareBirthdayInFeed?: boolean;
  guestbookEnabled?: boolean;
  mentionsAllowed?: boolean;
  notifPreviewPrivate?: boolean;
  bioVisibility?: VisibilityLevel;
  locationVisibility?: VisibilityLevel;
  zodiacVisibility?: VisibilityLevel;
  socialLinksVisibility?: VisibilityLevel;
}

const VISIBILITY_VALUES: VisibilityLevel[] = ['public', 'coven', 'private'];
const MESSAGE_VALUES: MessagePermission[] = ['everyone', 'coven', 'nobody'];

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }

  const body = req.body as PrivacyUpdate;
  const update: Partial<typeof user.$inferInsert> = {};

  // Validate and allow each field
  if (body.profileVisibility !== undefined) {
    if (!VISIBILITY_VALUES.includes(body.profileVisibility)) { res.status(400).json({ error: 'Invalid profileVisibility' }); return; }
    update.profileVisibility = body.profileVisibility;
  }
  if (body.discoverable !== undefined) update.discoverable = Boolean(body.discoverable);
  if (body.searchIndexed !== undefined) update.searchIndexed = Boolean(body.searchIndexed);
  if (body.hideOnlineStatus !== undefined) update.hideOnlineStatus = Boolean(body.hideOnlineStatus);
  if (body.messagePermission !== undefined) {
    if (!MESSAGE_VALUES.includes(body.messagePermission)) { res.status(400).json({ error: 'Invalid messagePermission' }); return; }
    update.messagePermission = body.messagePermission;
  }
  if (body.birthdayVisibility !== undefined) {
    if (!VISIBILITY_VALUES.includes(body.birthdayVisibility)) { res.status(400).json({ error: 'Invalid birthdayVisibility' }); return; }
    update.birthdayVisibility = body.birthdayVisibility;
  }
  if (body.shareBirthdayInFeed !== undefined) update.shareBirthdayInFeed = Boolean(body.shareBirthdayInFeed);
  if (body.guestbookEnabled !== undefined) update.guestbookEnabled = Boolean(body.guestbookEnabled);
  if (body.mentionsAllowed !== undefined) update.mentionsAllowed = Boolean(body.mentionsAllowed);
  if (body.notifPreviewPrivate !== undefined) update.notifPreviewPrivate = Boolean(body.notifPreviewPrivate);
  if (body.bioVisibility !== undefined) {
    if (!VISIBILITY_VALUES.includes(body.bioVisibility)) { res.status(400).json({ error: 'Invalid bioVisibility' }); return; }
    update.bioVisibility = body.bioVisibility;
  }
  if (body.locationVisibility !== undefined) {
    if (!VISIBILITY_VALUES.includes(body.locationVisibility)) { res.status(400).json({ error: 'Invalid locationVisibility' }); return; }
    update.locationVisibility = body.locationVisibility;
  }
  if (body.zodiacVisibility !== undefined) {
    if (!VISIBILITY_VALUES.includes(body.zodiacVisibility)) { res.status(400).json({ error: 'Invalid zodiacVisibility' }); return; }
    update.zodiacVisibility = body.zodiacVisibility;
  }
  if (body.socialLinksVisibility !== undefined) {
    if (!VISIBILITY_VALUES.includes(body.socialLinksVisibility)) { res.status(400).json({ error: 'Invalid socialLinksVisibility' }); return; }
    update.socialLinksVisibility = body.socialLinksVisibility;
  }

  if (Object.keys(update).length === 0) { res.status(400).json({ error: 'No valid fields provided' }); return; }

  await db.update(user).set(update).where(eq(user.id, session.user.id as string));
  res.json({ ok: true });
}
