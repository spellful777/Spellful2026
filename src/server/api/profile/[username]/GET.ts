import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, covenConnections, communityFollows, communityPosts } from '@/server/db/schema.js';
import { eq, and, or, count, sql, desc, inArray } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { isBlocked } from '@/server/lib/block-check.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const { username } = req.params;
    const session = await getAuthSession(req);
    const viewerId = session?.user?.id ?? null;

    // Resolve by normalized username — fall back to LOWER(username) for rows
    // where username_normalized hasn't been backfilled yet.
    const normalized = username.toLowerCase();
    const memberId = username.startsWith('~') ? username.slice(1) : null;
    const [profile] = await db
      .select({
        id: user.id,
        name: user.name,
        username: user.username,
        image: user.image,
        bio: user.bio,
        location: user.location,
        witchPath: user.witchPath,
        profileVisibility: user.profileVisibility,
        sunSign: user.sunSign,
        moonSign: user.moonSign,
        risingSign: user.risingSign,
        createdAt: user.createdAt,
        coverImage: user.coverImage,
        coverPreset: user.coverPreset,
        accentColor: user.accentColor,
        pronouns: user.pronouns,
        interestTags: user.interestTags,
        socialLinks: user.socialLinks,
        // Profile 3.0
        avatarPreset: user.avatarPreset,
        profileTheme: user.profileTheme,
        avatarFrame: user.avatarFrame,
        practiceLabels: user.practiceLabels,
        profileStatus: user.profileStatus,
        profileSections: user.profileSections,
        hideOnlineStatus: user.hideOnlineStatus,
        profileLayout: user.profileLayout,
        bioVisibility: user.bioVisibility,
        locationVisibility: user.locationVisibility,
        zodiacVisibility: user.zodiacVisibility,
        socialLinksVisibility: user.socialLinksVisibility,
      })
      .from(user)
      .where(
        memberId ? eq(user.id, memberId) : or(
          eq(user.usernameNormalized, normalized),
          sql`(username_normalized IS NULL AND LOWER(username) = ${normalized})`,
        )
      )
      .limit(1);

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Block check — return neutral "unavailable" to avoid disclosing the block
    if (viewerId && viewerId !== profile.id) {
      try {
        if (await isBlocked(viewerId, profile.id)) {
          return res.status(404).json({ error: 'Profile unavailable' });
        }
      } catch { return res.status(503).json({ error: 'Profile unavailable' }); }
    }

    const visibility = profile.profileVisibility ?? 'private';
    if (visibility === 'private' && profile.id !== viewerId)
      return res.status(403).json({ error: 'This profile is private' });

    if (visibility === 'coven' && profile.id !== viewerId) {
      if (!viewerId) return res.status(403).json({ error: 'This profile is coven-only' });
      const [conn] = await db.select().from(covenConnections).where(
        and(or(
          and(eq(covenConnections.requesterId, viewerId), eq(covenConnections.receiverId, profile.id)),
          and(eq(covenConnections.requesterId, profile.id), eq(covenConnections.receiverId, viewerId))
        ), eq(covenConnections.status, 'accepted'))
      ).limit(1);
      if (!conn) return res.status(403).json({ error: 'This profile is coven-only' });
    }

    let connectionStatus: string | null = null;
    let connectionId: number | null = null;
    if (viewerId && profile.id !== viewerId) {
      const [conn] = await db
        .select({ id: covenConnections.id, status: covenConnections.status, requesterId: covenConnections.requesterId })
        .from(covenConnections).where(
          or(
            and(eq(covenConnections.requesterId, viewerId), eq(covenConnections.receiverId, profile.id)),
            and(eq(covenConnections.requesterId, profile.id), eq(covenConnections.receiverId, viewerId))
          )
        ).limit(1);
      if (conn) {
        connectionId = conn.id;
        if (conn.status === 'pending') {
          connectionStatus = conn.requesterId === viewerId ? 'pending_sent' : 'pending_received';
        } else {
          connectionStatus = conn.status;
        }
      }
    }

    // Coven count (accepted connections)
    const [[covenRow], [followerRow]] = await Promise.all([
      db.select({ n: count() }).from(covenConnections).where(
        and(
          or(
            eq(covenConnections.requesterId, profile.id),
            eq(covenConnections.receiverId, profile.id)
          ),
          eq(covenConnections.status, 'accepted')
        )
      ),
      db.select({ n: count() }).from(communityFollows).where(
        eq(communityFollows.followingId, profile.id)
      ),
    ]);
    const covenCount = Number(covenRow?.n ?? 0);
    const followerCount = Number(followerRow?.n ?? 0);

    const isOwn = profile.id === viewerId;
    const audiences = isOwn || connectionStatus === 'accepted' ? ['public', 'coven'] : ['public'];
    const latestPosts = await db.select({
      id: communityPosts.id,
      title: communityPosts.title,
      createdAt: communityPosts.createdAt,
    }).from(communityPosts).where(and(
      eq(communityPosts.userId, profile.id),
      eq(communityPosts.isHidden, false),
      inArray(communityPosts.audience, audiences),
    )).orderBy(desc(communityPosts.createdAt), desc(communityPosts.id)).limit(4);

    res.set('Cache-Control', 'private, no-store');
    res.json({ profile, connectionStatus, connectionId, isOwn, covenCount, followerCount, latestPosts });
  } catch (err) {
    console.error(JSON.stringify({ event: 'profile.get.error', msg: String(err).slice(0, 400) }));
    res.status(500).json({ error: 'Failed to load profile' });
  }
}