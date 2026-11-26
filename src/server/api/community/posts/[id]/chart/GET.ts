import type { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPosts } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { postAudienceAllows } from '@/server/lib/community-post-access.js';
import { natalWheelSvg, parseSparkReading } from '@/lib/spark-reading';

export default async function chartImage(req: Request<{ id: string }>, res: Response) {
  const viewer = (await getAuthSession(req))?.user?.id;
  const id = Number(req.params.id);
  res.setHeader('Cache-Control', 'private, no-store');
  if (!Number.isSafeInteger(id) || id < 1) return res.sendStatus(404);
  const [post] = await db.select({ reading: communityPosts.sparkReading }).from(communityPosts)
    .where(and(eq(communityPosts.id, id), eq(communityPosts.type, 'spark'),
      eq(communityPosts.isHidden, false), postAudienceAllows(viewer))).limit(1);
  const reading = parseSparkReading(post?.reading);
  if (!reading || reading.type !== 'natal') return res.sendStatus(404);
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  res.set('X-Content-Type-Options', 'nosniff');
  return res.type('image/svg+xml').send(natalWheelSvg(reading));
}
