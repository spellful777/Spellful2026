/**
 * PUT /api/community/help/faq/:id — Admin: update a FAQ entry
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

  const { category, question, answer, sortOrder, isPublished } = req.body as {
    category?: string; question?: string; answer?: string;
    sortOrder?: number; isPublished?: boolean;
  };

  try {
    await db.update(communityFaq)
      .set({
        ...(category !== undefined && { category }),
        ...(question !== undefined && { question }),
        ...(answer !== undefined && { answer }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isPublished !== undefined && { isPublished }),
      })
      .where(eq(communityFaq.id, id));

    const [updated] = await db.select().from(communityFaq).where(eq(communityFaq.id, id)).limit(1);
    res.json({ ok: true, item: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update FAQ entry' });
  }
}
