import { profileAudience } from '@/server/lib/profile-audience.js';
/**
 * GET /api/profile/:username/gallery
 * Returns public gallery items for a profile (respects visibility + blocks).
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, profileGallery } from '@/server/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const session = await getAuthSession(req);
  const viewerId = session?.user?.id ?? null;
  const normalized = req.params.username.toLowerCase();

  const [profile] = await db
    .select({ id: user.id, profileVisibility: user.profileVisibility, sections: user.profileSections })
    .from(user).where(eq(user.usernameNormalized, normalized)).limit(1);
  if (!profile) return res.status(404).json({ error: 'Profile not found' });

  res.setHeader('Cache-Control', 'private, no-store');
  const access = await profileAudience(profile, viewerId, req.query.preview);
  if (!access?.allowed || (!access.owner && profile.sections?.some(section => section.id === 'gallery' && !section.enabled)))
    return res.status(404).json({ error: 'Profile unavailable' });
  const isOwner = access.owner;
  const isCoven = access.coven;

  // Determine which visibility levels the viewer can see
  const allowedVisibilities: string[] = ['public'];
  if (isOwner) allowedVisibilities.push('coven', 'private');
  else if (isCoven) allowedVisibilities.push('coven');

  const items = await db
    .select()
    .from(profileGallery)
    .where(and(
      eq(profileGallery.userId, profile.id),
      inArray(profileGallery.visibility, allowedVisibilities),
    ))
    .orderBy(profileGallery.sortOrder, profileGallery.createdAt);

  res.json({ items });
}
