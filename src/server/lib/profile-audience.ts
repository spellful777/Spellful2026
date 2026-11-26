import { and, eq, or } from 'drizzle-orm';
import { db } from '@/server/db/client.js';
import { covenConnections } from '@/server/db/schema.js';
import { isBlocked } from './block-check.js';

export async function profileAudience(profile: { id: string; profileVisibility: string | null }, viewer: string | null, preview: unknown) {
  const actualOwner = viewer === profile.id;
  const publicPreview = actualOwner && (preview === 'public' || preview === 'guest');
  const covenPreview = actualOwner && (preview === 'coven' || preview === 'member');
  const owner = actualOwner && !publicPreview && !covenPreview;
  if (viewer && !actualOwner && await isBlocked(profile.id, viewer)) return null;
  const [connection] = viewer && !actualOwner ? await db.select({
    id: covenConnections.id, status: covenConnections.status, requesterId: covenConnections.requesterId,
  }).from(covenConnections).where(or(
    and(eq(covenConnections.requesterId, profile.id), eq(covenConnections.receiverId, viewer)),
    and(eq(covenConnections.receiverId, profile.id), eq(covenConnections.requesterId, viewer)),
  )).limit(1) : [];
  const coven = covenPreview || connection?.status === 'accepted';
  const visibility = profile.profileVisibility ?? 'private';
  const allowed = owner || visibility === 'public' || (visibility === 'coven' && coven);
  const allows = (field: string | null | undefined) =>
    owner || !field || field === 'public' || (field === 'coven' && coven);
  return { owner, allowed, coven, connection, preview: publicPreview || covenPreview, allows,
    tiers: owner ? ['public', 'coven', 'private'] : coven ? ['public', 'coven'] : ['public'] };
}
