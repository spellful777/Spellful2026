/**
 * DELETE /api/community/help/faq/:id — Admin: delete a FAQ entry
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityFaq } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await db.delete(communityFaq).where(eq(communityFaq.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete FAQ entry' });
  }
}
