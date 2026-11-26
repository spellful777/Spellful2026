/**
 * GET /api/community/help/glossary
 * Returns published glossary entries, optionally filtered by category, letter, or search.
 * Query params: category (string), letter (A-Z), q (search string)
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityGlossary } from '@/server/db/schema.js';
import { eq, and, like, asc } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  try {
    const { category, letter, q } = req.query as { category?: string; letter?: string; q?: string };

    const conditions = [eq(communityGlossary.isPublished, true)];
    if (category) conditions.push(eq(communityGlossary.category, category));
    if (letter?.match(/^[A-Za-z]$/)) {
      conditions.push(like(communityGlossary.termNormalized, letter.toLowerCase() + '%'));
    }
    if (q?.trim()) {
      const term = '%' + q.trim().replace(/[%_\\]/g, '\\$&') + '%';
      conditions.push(like(communityGlossary.term, term));
    }

    const rows = await db
      .select()
      .from(communityGlossary)
      .where(and(...conditions))
      .orderBy(asc(communityGlossary.termNormalized));

    // Build alphabetical index of available letters
    const allLetters = await db
      .select({ termNormalized: communityGlossary.termNormalized })
      .from(communityGlossary)
      .where(eq(communityGlossary.isPublished, true));

    const availableLetters = [...new Set(allLetters.map((r) => r.termNormalized[0]?.toUpperCase()).filter(Boolean))].sort();

    const categories = [...new Set(rows.map((r) => r.category))].sort();

    res.json({ items: rows, availableLetters, categories });
  } catch {
    res.status(500).json({ error: 'Failed to load glossary' });
  }
}
