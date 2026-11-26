/**
 * POST /api/community/help/faq — Admin: create a new FAQ entry
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityFaq } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { category, question, answer, sortOrder = 0, isPublished = true } = req.body as {
    category?: string; question?: string; answer?: string;
    sortOrder?: number; isPublished?: boolean;
  };

  if (!category?.trim() || !question?.trim() || !answer?.trim()) {
    return res.status(400).json({ error: 'category, question, and answer are required' });
  }

  try {
    const [result] = await db.insert(communityFaq).values({
      category: category.trim(),
      question: question.trim(),
      answer: answer.trim(),
      sortOrder,
      isPublished,
      createdBy: session.user.id,
    });
    res.status(201).json({ ok: true, id: (result as { insertId: number }).insertId });
  } catch {
    res.status(500).json({ error: 'Failed to create FAQ entry' });
  }
}
