/**
 * POST /api/bug-reports
 * Submit a bug report. Authenticated users only.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { bugReports } from '@/server/db/schema.js';
import { getAuthSession } from '@/server/lib/auth-session.js';

const VALID_CATEGORIES = ['general', 'display', 'performance', 'account', 'messaging', 'community', 'tarot', 'astrology', 'other'];

function generateTicketRef(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let ref = 'BUG-';
  for (let i = 0; i < 6; i++) ref += chars[Math.floor(Math.random() * chars.length)];
  return ref;
}

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) {
    return res.status(401).json({ error: 'Sign in to submit a bug report' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const { title, description, category, stepsToReproduce, expectedBehavior, pageUrl, deviceInfo } = req.body as {
    title?: string; description?: string; category?: string;
    stepsToReproduce?: string; expectedBehavior?: string;
    pageUrl?: string; deviceInfo?: string;
  };

  if (!title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'Title and description are required' });
  }
  if (title.length > 255) return res.status(400).json({ error: 'Title too long' });

  const cat = VALID_CATEGORIES.includes(category ?? '') ? (category ?? 'general') : 'general';
  const ticketRef = generateTicketRef();

  await db.insert(bugReports).values({
    reporterId: session.user.id,
    title: title.trim(),
    description: description.trim(),
    category: cat,
    stepsToReproduce: stepsToReproduce?.trim() ?? null,
    expectedBehavior: expectedBehavior?.trim() ?? null,
    pageUrl: (pageUrl ?? '').slice(0, 500),
    deviceInfo: (deviceInfo ?? '').slice(0, 500),
    ticketRef,
    status: 'new',
  });

  return res.status(201).json({ ok: true, ticketRef });
}
