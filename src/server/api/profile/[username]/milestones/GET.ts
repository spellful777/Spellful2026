import { profileAudience } from '@/server/lib/profile-audience.js';
/**
 * GET /api/profile/:username/milestones
 * Returns visible milestones for a public profile.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, profileMilestones } from '@/server/db/schema.js';
import { eq, and, inArray, asc } from 'drizzle-orm';
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
  if (!access?.allowed || (!access.owner && profileUser.sections?.some(section => section.id === 'milestones' && !section.enabled)))
    return res.status(404).json({ error: 'Profile unavailable' });
  const isOwner = access.owner;
  const isCoven = access.coven;

  const allowed: string[] = ['public'];
  if (isOwner || isCoven) allowed.push('coven');
  if (isOwner) allowed.push('private');

  const milestones = await db.select().from(profileMilestones)
    .where(and(
      eq(profileMilestones.userId, profileUser.id),
      inArray(profileMilestones.visibility, allowed),
    ))
    .orderBy(asc(profileMilestones.position));

  res.json({ milestones });
}
