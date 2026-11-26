/**
 * POST /api/community/help/rules/acknowledge
 * Records that the signed-in user has acknowledged the current community rules.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityRules, communityRuleAcknowledgments } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Sign in to acknowledge' });

  try {
    const [rules] = await db
      .select({ version: communityRules.version })
      .from(communityRules)
      .where(eq(communityRules.isCurrent, true))
      .limit(1);

    if (!rules) return res.status(404).json({ error: 'No current rules found' });

    await db
      .insert(communityRuleAcknowledgments)
      .values({ userId: session.user.id, ruleVersion: rules.version })
      .onDuplicateKeyUpdate({ set: { acknowledgedAt: new Date() } });

    res.json({ ok: true, version: rules.version });
  } catch {
    res.status(500).json({ error: 'Failed to record acknowledgment' });
  }
}
