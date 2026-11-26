/**
 * GET /api/community/help/faq
 * Returns published FAQ entries, optionally filtered by category or search query.
 * Query params: category (string), q (search string)
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityFaq } from '@/server/db/schema.js';
import { eq, and, like, asc } from 'drizzle-orm';

export default async function handler(req: Request, res: Response) {
  try {
    const { category, q } = req.query as { category?: string; q?: string };

    const conditions = [eq(communityFaq.isPublished, true)];
    if (category) conditions.push(eq(communityFaq.category, category));
    if (q?.trim()) {
      const term = '%' + q.trim().replace(/[%_\\]/g, '\\$&') + '%';
      conditions.push(like(communityFaq.question, term));
    }

    const rows = await db
      .select()
      .from(communityFaq)
      .where(and(...conditions))
      .orderBy(asc(communityFaq.category), asc(communityFaq.sortOrder));

    // Group by category
    const grouped: Record<string, typeof rows> = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }

    const categories = Object.keys(grouped).sort();
    res.json({ categories, items: rows, grouped });
  } catch {
    res.status(500).json({ error: 'Failed to load FAQ' });
  }
}
