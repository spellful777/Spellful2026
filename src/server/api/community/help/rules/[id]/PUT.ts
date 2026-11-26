/**
 * PUT /api/community/help/rules/:id
 * Admin: update a rules document. Pass { isCurrent: true } to make it the active version
 * (automatically sets all others to isCurrent=false).
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityRules } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ id: string }>, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !(session.user as { isAdmin?: boolean }).isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { title, summary, body, version, effectiveDate, isCurrent } = req.body as {
    title?: string; summary?: string; body?: string;
    version?: string; effectiveDate?: string; isCurrent?: boolean;
  };

  try {
    if (isCurrent) {
      // Demote all others first
      await db.update(communityRules).set({ isCurrent: false });
    }

    await db.update(communityRules)
      .set({
        ...(title !== undefined && { title }),
        ...(summary !== undefined && { summary }),
        ...(body !== undefined && { body }),
        ...(version !== undefined && { version }),
        ...(effectiveDate !== undefined && { effectiveDate }),
        ...(isCurrent !== undefined && { isCurrent }),
      })
      .where(eq(communityRules.id, id));

    const [updated] = await db.select().from(communityRules).where(eq(communityRules.id, id)).limit(1);
    res.json({ ok: true, rules: updated });
  } catch {
    res.status(500).json({ error: 'Failed to update rules' });
  }
}
