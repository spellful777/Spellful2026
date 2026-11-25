/**
 * GET /api/account/profile
 * Returns the authenticated user's own profile data for the account settings page.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });

  const [row] = await db
    .select({
      username: user.username,
      name: user.name,
      bio: user.bio,
      location: user.location,
      witchPath: user.witchPath,
      profileVisibility: user.profileVisibility,
      sunSign: user.sunSign,
      moonSign: user.moonSign,
      risingSign: user.risingSign,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!row) return res.status(404).json({ error: 'User not found' });

  res.json({
    profile: {
      username: row.username ?? '',
      name: row.name ?? '',
      bio: row.bio ?? '',
      location: row.location ?? '',
      witchPath: row.witchPath ?? '',
      visibility: row.profileVisibility ?? 'public',
      sunSign: row.sunSign ?? '',
      moonSign: row.moonSign ?? '',
      risingSign: row.risingSign ?? '',
    },
  });
}
