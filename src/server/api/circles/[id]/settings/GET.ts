import type { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPosts } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { circleAccess } from '@/server/lib/circle-moderation.js';
import { visiblePostForMember } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  res.set('Cache-Control', 'private, no-store');
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to view Circle settings' });
  const viewer = session.user.id;
  const circleId = Number(req.params.id);
  if (!Number.isSafeInteger(circleId) || circleId < 1) return res.status(400).json({ error: 'Invalid Circle' });

  const circle = await circleAccess(circleId, viewer);
  if (!circle) return res.status(404).json({ error: 'Circle unavailable' });

  let welcome = null;
  if (circle.welcomePostId) {
    const [post] = await db.select({ id: communityPosts.id, title: communityPosts.title }).from(communityPosts)
      .where(and(eq(communityPosts.circleId, circleId), visiblePostForMember(circle.welcomePostId, viewer))).limit(1);
    welcome = post ?? null;
  }
  res.json({ rules: circle.rules ?? '', welcome, canModerate: Boolean(circle.canModerate) });
}
