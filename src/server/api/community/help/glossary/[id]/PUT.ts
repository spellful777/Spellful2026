/**
 * PUT /api/community/help/glossary/:id — Admin: update a glossary entry
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityGlossary } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { term, category, definition, traditionNotes, relatedTerms, isPublished } = req.body as {
    term?: string; category?: string; definition?: string;
    traditionNotes?: string; relatedTerms?: string[]; isPublished?: boolean;
  };

  try {
    await db.update(communityGlossary)
      .set({
        ...(term !== undefined && { term, termNormalized: term.toLowerCase() }),
        ...(category !== undefined && { category }),
        ...(definition !== undefined && { definition }),
        ...(traditionNotes !== undefined && { traditionNotes }),
        ...(relatedTerms !== undefined && { relatedTerms }),
        ...(isPublished !== undefined && { isPublished }),
      })
      .where(eq(communityGlossary.id, id));

    const [updated] = await db.select().from(communityGlossary).where(eq(communityGlossary.id, id)).limit(1);
    res.json({ ok: true, item: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update glossary entry' });
  }
}
