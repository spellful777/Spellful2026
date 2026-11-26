import type { Request, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { communityPosts } from '@/server/db/schema.js';
import { parseSparkReading } from '@/lib/spark-reading';

export async function sparkShareMeta(req: Request<{ id: string }>, res: Response) {
  const id = Number(req.params.id);
  res.setHeader('Cache-Control', 'no-store');
  if (!Number.isSafeInteger(id) || id < 1) return res.sendStatus(404);
  const [post] = await db.select({ reading: communityPosts.sparkReading }).from(communityPosts)
    .where(and(eq(communityPosts.id, id), eq(communityPosts.type, 'spark'), eq(communityPosts.isHidden, false),
      eq(communityPosts.audience, 'public'))).limit(1);
  const reading = parseSparkReading(post?.reading);
  if (!reading) return res.sendStatus(404);
  return res.json(reading.type === 'horoscope' ? reading : { type: reading.type });
}
