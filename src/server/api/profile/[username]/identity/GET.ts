import { profileAudience } from '@/server/lib/profile-audience.js';
/**
 * GET /api/profile/:username/identity
 * Returns identity fields for a public profile, respecting visibility.
 * Viewer auth determines which visibility tiers are shown.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, profileIdentityFields } from '@/server/db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const normalized = req.params.username.toLowerCase();
  const [profileUser] = await db.select({ id: user.id, profileVisibility: user.profileVisibility, sections: user.profileSections })
    .from(user).where(eq(user.usernameNormalized, normalized)).limit(1);
  if (!profileUser) return res.status(404).json({ error: 'Not found' });

  const session = await getAuthSession(req);
  const viewerId = session?.user.id ?? null;

  // Block check
  res.setHeader('Cache-Control', 'private, no-store');
  const access = await profileAudience(profileUser, viewerId, req.query.preview);
  if (!access?.allowed || (!access.owner && profileUser.sections?.some(section => section.id === 'about' && !section.enabled)))
    return res.status(404).json({ error: 'Profile unavailable' });
  const isOwner = access.owner;
  const isCoven = access.coven;

  const allowed: string[] = ['public'];
  if (isOwner || isCoven) allowed.push('coven');
  if (isOwner) allowed.push('private');

  const fields = await db.select()
    .from(profileIdentityFields)
    .where(and(
      eq(profileIdentityFields.userId, profileUser.id),
      inArray(profileIdentityFields.visibility, allowed),
    ));

  res.json({ fields });
}
