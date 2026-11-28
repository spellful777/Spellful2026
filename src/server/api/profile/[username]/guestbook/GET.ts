import { memberAvatar } from '@/server/lib/member-avatar.js';
import { profileAudience } from '@/server/lib/profile-audience.js';
/**
 * GET /api/profile/:username/guestbook
 * Returns approved guestbook entries for a public profile.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, profileGuestbookSettings, profileGuestbookEntries } from '@/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const normalized = req.params.username.toLowerCase();
  const [profileUser] = await db.select({ id: user.id, profileVisibility: user.profileVisibility, sections: user.profileSections }).from(user)
    .where(eq(user.usernameNormalized, normalized)).limit(1);
  if (!profileUser) return res.status(404).json({ error: 'Not found' });

  const session = await getAuthSession(req);
  const viewerId = session?.user.id ?? null;

  res.setHeader('Cache-Control', 'private, no-store');
  const access = await profileAudience(profileUser, viewerId, req.query.preview);
  if (!access?.allowed || (!access.owner && profileUser.sections?.some(section => section.id === 'guestbook' && !section.enabled)))
    return res.status(404).json({ error: 'Profile unavailable' });
  const isOwner = access.owner;
  const isCoven = access.coven;

  const [settings] = await db.select().from(profileGuestbookSettings)
    .where(eq(profileGuestbookSettings.userId, profileUser.id));

  if (!settings?.enabled) return res.json({ enabled: false, entries: [] });

  const sectionVis = settings.visibility ?? 'coven';
  if (sectionVis === 'private' && !isOwner) return res.json({ enabled: false, entries: [] });
  if (sectionVis === 'coven' && !isOwner && !isCoven) return res.json({ enabled: false, entries: [] });

  const entries = await db
    .select({
      id: profileGuestbookEntries.id,
      text: profileGuestbookEntries.text,
      createdAt: profileGuestbookEntries.createdAt,
      authorUsername: user.username,
      authorImage: memberAvatar,
    })
    .from(profileGuestbookEntries)
    .innerJoin(user, eq(profileGuestbookEntries.authorUserId, user.id))
    .where(and(
      eq(profileGuestbookEntries.profileUserId, profileUser.id),
      eq(profileGuestbookEntries.moderationState, 'approved'),
    ))
    .orderBy(desc(profileGuestbookEntries.createdAt))
    .limit(50);

  res.json({ enabled: true, settings: { allowedSubmitters: settings.allowedSubmitters, visibility: sectionVis }, entries });
}
