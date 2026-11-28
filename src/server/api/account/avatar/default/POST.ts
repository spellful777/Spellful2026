import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';

import { findDefaultAvatar } from '@/lib/default-avatars';

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session?.user?.id) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const hat = findDefaultAvatar(req.body?.url);
  if (!hat) {
    res.status(400).json({ error: 'Invalid avatar selection.' });
    return;
  }

  await db.update(user).set({ image: hat.src, avatarPreset: hat.key }).where(eq(user.id, session.user.id));
  res.json({ url: hat.src });
}
