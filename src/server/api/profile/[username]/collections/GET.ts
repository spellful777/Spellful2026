import { profileAudience } from '@/server/lib/profile-audience.js';
/**
 * GET /api/profile/:username/collections
 * Returns collections + items for a public profile, respecting visibility.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, profileCollections, profileCollectionItems } from '@/server/db/schema.js';
import { eq, and, inArray, asc } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const normalized = req.params.username.toLowerCase();
  const [profileUser] = await db.select({ id: user.id, profileVisibility: user.profileVisibility, sections: user.profileSections })
    .from(user).where(eq(user.usernameNormalized, normalized)).limit(1);
  if (!profileUser) return res.status(404).json({ error: 'Not found' });

  const session = await getAuthSession(req);
  const viewerId = session?.user.id ?? null;

  res.setHeader('Cache-Control', 'private, no-store');
  const access = await profileAudience(profileUser, viewerId, req.query.preview);
  if (!access?.allowed || (!access.owner && profileUser.sections?.some(section => section.id === 'favorites' && !section.enabled)))
    return res.status(404).json({ error: 'Profile unavailable' });
  const isOwner = access.owner;
  const isCoven = access.coven;

  const allowedCollVis: string[] = ['public'];
  if (isOwner || isCoven) allowedCollVis.push('coven');
  if (isOwner) allowedCollVis.push('private');

  const allowedItemVis: string[] = ['public'];
  if (isOwner || isCoven) allowedItemVis.push('coven');
  if (isOwner) allowedItemVis.push('private');

  const collections = await db.select().from(profileCollections)
    .where(and(eq(profileCollections.userId, profileUser.id), inArray(profileCollections.visibility, allowedCollVis)))
    .orderBy(asc(profileCollections.position));

  if (!collections.length) return res.json({ collections: [] });

  const collectionIds = collections.map(c => c.id);
  const allItems = await db.select().from(profileCollectionItems)
    .where(and(inArray(profileCollectionItems.collectionId, collectionIds), inArray(profileCollectionItems.visibility, allowedItemVis)))
    .orderBy(asc(profileCollectionItems.position));

  const itemsByCollection: Record<number, typeof allItems> = {};
  for (const item of allItems) {
    if (!itemsByCollection[item.collectionId]) itemsByCollection[item.collectionId] = [];
    itemsByCollection[item.collectionId].push(item);
  }

  res.json({ collections: collections.map(c => ({ ...c, items: itemsByCollection[c.id] ?? [] })) });
}
