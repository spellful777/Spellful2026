/**
 * GET /api/users/:id
 * Returns minimal public info for a user by their ID.
 * Used by the DM thread header to resolve a username when the conversation
 * summary was loaded before the other user had set one.
 */
import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const { id } = req.params;
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const [row] = await db
    .select({ username: user.username, name: user.name, image: user.image })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);

  if (!row) return res.status(404).json({ error: 'Not found' });

  res.json({ username: row.username ?? null, name: row.name ?? null, image: row.image ?? null });
}
