/**
 * POST /api/community/help/glossary — Admin: create a glossary entry
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityGlossary } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { term, category, definition, traditionNotes, relatedTerms, isPublished = true } = req.body as {
    term?: string; category?: string; definition?: string;
    traditionNotes?: string; relatedTerms?: string[]; isPublished?: boolean;
  };

  if (!term?.trim() || !category?.trim() || !definition?.trim()) {
    return res.status(400).json({ error: 'term, category, and definition are required' });
  }

  try {
    const [result] = await db.insert(communityGlossary).values({
      term: term.trim(),
      termNormalized: term.trim().toLowerCase(),
      category: category.trim(),
      definition: definition.trim(),
      traditionNotes: traditionNotes?.trim() ?? null,
      relatedTerms: relatedTerms ?? [],
      isPublished,
      createdBy: session.user.id,
    });
    res.status(201).json({ ok: true, id: (result as { insertId: number }).insertId });
  } catch {
    res.status(500).json({ error: 'Failed to create glossary entry' });
  }
}
