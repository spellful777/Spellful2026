/**
 * GET /api/account/privacy-settings
 * Returns the authenticated member's privacy settings.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }
  if (!db) { res.status(503).json({ error: 'Database unavailable' }); return; }

  const [row] = await db
    .select({
      profileVisibility: user.profileVisibility,
      discoverable: user.discoverable,
      searchIndexed: user.searchIndexed,
      hideOnlineStatus: user.hideOnlineStatus,
      messagePermission: user.messagePermission,
      birthdayVisibility: user.birthdayVisibility,
      shareBirthdayInFeed: user.shareBirthdayInFeed,
      guestbookEnabled: user.guestbookEnabled,
      shareFollowers: user.shareFollowers,
      mentionsAllowed: user.mentionsAllowed,
      notifPreviewPrivate: user.notifPreviewPrivate,
      bioVisibility: user.bioVisibility,
      locationVisibility: user.locationVisibility,
      zodiacVisibility: user.zodiacVisibility,
      socialLinksVisibility: user.socialLinksVisibility,
    })
    .from(user)
    .where(eq(user.id, session.user.id as string));

  if (!row) { res.status(404).json({ error: 'User not found' }); return; }

  res.json({ settings: row });
}
