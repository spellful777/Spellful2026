import type { Request, Response } from 'express';
import { and, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPosts } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { circleAccess } from '@/server/lib/circle-moderation.js';
import { visiblePostForMember } from '@/server/lib/community-post-access.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to manage this Circle' });
  const viewer = session.user.id;
  const circleId = Number(req.params.id);
  if (!Number.isSafeInteger(circleId) || circleId < 1) return res.status(400).json({ error: 'Invalid Circle' });

  const circle = await circleAccess(circleId, viewer);
  if (!circle?.canModerate) return res.status(403).json({ error: 'Circle moderator access required' });

  const { rules, welcomePostId } = (req.body ?? {}) as { rules?: unknown; welcomePostId?: unknown };
  const changes: SQL[] = [];
  if (rules !== undefined) {
    if (typeof rules !== 'string' || rules.length > 4000) return res.status(400).json({ error: 'Rules must be 4,000 characters or fewer' });
    changes.push(sql`rules = ${rules.trim()}`);
  }

  if (welcomePostId !== undefined) {
    if (welcomePostId !== null) {
      if (typeof welcomePostId !== 'number' || !Number.isSafeInteger(welcomePostId) || welcomePostId < 1) {
        return res.status(400).json({ error: 'Invalid welcome post' });
      }
      const [post] = await db.select({ id: communityPosts.id }).from(communityPosts)
        .where(and(eq(communityPosts.circleId, circleId), visiblePostForMember(welcomePostId, viewer))).limit(1);
      if (!post) return res.status(404).json({ error: 'Welcome post unavailable in this Circle' });
    }
    changes.push(sql`welcome_post_id = ${welcomePostId}`);
  }

  if (!changes.length) return res.status(400).json({ error: 'No Circle settings supplied' });
  await db.execute(sql`update spellful_circles set ${sql.join(changes, sql`, `)} where id = ${circleId}`);
  res.json({ ok: true });
}
