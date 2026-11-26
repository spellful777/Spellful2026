/**
 * GET /api/community/help/rules
 * Returns the current community rules and whether the signed-in user has acknowledged them.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { communityRules, communityRuleAcknowledgments } from '@/server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  try {
    const [rules] = await db
      .select()
      .from(communityRules)
      .where(eq(communityRules.isCurrent, true))
      .limit(1);

    if (!rules) return res.status(404).json({ error: 'No community rules found' });

    let acknowledged = false;
    const session = await getAuthSession(req);
    if (session?.user?.id) {
      const [ack] = await db
        .select()
        .from(communityRuleAcknowledgments)
        .where(
          and(
            eq(communityRuleAcknowledgments.userId, session.user.id),
            eq(communityRuleAcknowledgments.ruleVersion, rules.version),
          ),
        )
        .limit(1);
      acknowledged = !!ack;
    }

    res.json({ rules, acknowledged });
  } catch {
    res.status(500).json({ error: 'Failed to load community rules' });
  }
}
