import { profileAudience } from '@/server/lib/profile-audience.js';
/**
 * GET /api/profile/:username/soundscapes
 * Returns soundscapes settings + visible playlists for a public profile.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, profileSoundscapesSettings, profilePlaylists } from '@/server/db/schema.js';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const normalized = req.params.username.toLowerCase();
  const [profileUser] = await db.select({ id: user.id, profileVisibility: user.profileVisibility, sections: user.profileSections })
    .from(user).where(eq(user.usernameNormalized, normalized)).limit(1);
  if (!profileUser) return res.status(404).json({ error: 'Not found' });

  const session = await getAuthSession(req);
  const viewerId = session?.user.id ?? null;

  res.setHeader('Cache-Control', 'private, no-store');
  const access = await profileAudience(profileUser, viewerId, req.query.preview);
  if (!access?.allowed || (!access.owner && profileUser.sections?.some(section => section.id === 'soundscapes' && !section.enabled)))
    return res.status(404).json({ error: 'Profile unavailable' });
  const isOwner = access.owner;
  const isCoven = access.coven;

  const [settings] = await db.select().from(profileSoundscapesSettings)
    .where(eq(profileSoundscapesSettings.userId, profileUser.id));

  if (!settings?.enabled) return res.json({ enabled: false, playlists: [] });

  // Section visibility check
  const sectionVis = settings.visibility ?? 'private';
  if (sectionVis === 'private' && !isOwner) return res.json({ enabled: false, playlists: [] });
  if (sectionVis === 'coven' && !isOwner && !isCoven) return res.json({ enabled: false, playlists: [] });

  const allowed: string[] = ['public'];
  if (isOwner || isCoven) allowed.push('coven');
  if (isOwner) allowed.push('private');

  const playlists = await db.select().from(profilePlaylists)
    .where(and(
      eq(profilePlaylists.userId, profileUser.id),
      inArray(profilePlaylists.visibility, allowed),
    ))
    .orderBy(asc(profilePlaylists.position));

  res.json({ enabled: true, visibility: sectionVis, playlists });
}
