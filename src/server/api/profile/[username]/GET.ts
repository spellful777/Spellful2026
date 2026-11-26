import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, covenConnections, communityBlocks, userFollows } from '@/server/db/schema.js';
import { eq, and, or, count, desc, isNotNull, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { isBlocked } from '@/server/lib/block-check.js';

export default async function handler(req: Request<{ username: string }>, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    res.setHeader('Cache-Control', 'private, no-store');
    const { username } = req.params;
    const session = await getAuthSession(req);
    const viewerId = session?.user?.id ?? null;

    // Resolve by normalized username — fall back to LOWER(username) for rows
    // where username_normalized hasn't been backfilled yet.
    const normalized = username.toLowerCase();
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
        shareFollowing: user.shareFollowing,
        invitePermission: user.invitePermission,
        profileLayout: user.profileLayout,
        bioVisibility: user.bioVisibility,
        locationVisibility: user.locationVisibility,
        zodiacVisibility: user.zodiacVisibility,
        socialLinksVisibility: user.socialLinksVisibility,
      })
      .from(user)
      .where(
        or(
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
      } catch {
        return res.status(503).json({ error: 'Profile temporarily unavailable' });
      }
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

    const isOwn = profile.id === viewerId;
    const canViewFollowing = isOwn || profile.shareFollowing;
    if (req.query.following === '1') {
      if (!canViewFollowing) return res.status(403).json({ error: 'Following list is private' });

      const pageSize = 30;
      const before = Number(req.query.before);
      const entries = await db
        .select({ followId: userFollows.id, username: user.username, name: user.name, image: user.image })
        .from(userFollows)
        .innerJoin(user, eq(user.id, userFollows.followingId))
        .where(and(
          eq(userFollows.followerId, profile.id),
          isNotNull(user.username),
          Number.isSafeInteger(before) && before > 0 ? sql`${userFollows.id} < ${before}` : undefined,
          or(
            eq(user.profileVisibility, 'public'),
            viewerId ? eq(user.id, viewerId) : undefined,
            viewerId ? and(eq(user.profileVisibility, 'coven'), sql`exists (
              select 1 from ${covenConnections} where ${covenConnections.status} = 'accepted' and (
                (${covenConnections.requesterId} = ${viewerId} and ${covenConnections.receiverId} = ${user.id}) or
                (${covenConnections.receiverId} = ${viewerId} and ${covenConnections.requesterId} = ${user.id})
              )
            )`) : undefined,
          ),
          viewerId ? sql`not exists (
            select 1 from ${communityBlocks} where
              (${communityBlocks.blockerId} = ${viewerId} and ${communityBlocks.blockedId} = ${user.id}) or
              (${communityBlocks.blockedId} = ${viewerId} and ${communityBlocks.blockerId} = ${user.id})
          )` : undefined,
        ))
        .orderBy(desc(userFollows.id))
        .limit(pageSize + 1);
      const members = entries.slice(0, pageSize);
      return res.json({
        members: members.map(({ username, name, image }) => ({ username, name, image })),
        next: entries.length > pageSize ? members[pageSize - 1].followId : null,
      });
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
    const [[covenRow], [followerRow], [following]] = await Promise.all([
      db.select({ n: count() }).from(covenConnections).where(
        and(
          or(
            eq(covenConnections.requesterId, profile.id),
            eq(covenConnections.receiverId, profile.id)
          ),
          eq(covenConnections.status, 'accepted')
        )
      ),
      db.select({ n: count() }).from(userFollows).where(
        eq(userFollows.followingId, profile.id)
      ),
      viewerId && !isOwn
        ? db.select({ id: userFollows.id }).from(userFollows).where(and(
            eq(userFollows.followerId, viewerId),
            eq(userFollows.followingId, profile.id),
          )).limit(1)
        : [],
    ]);
    const covenCount = Number(covenRow?.n ?? 0);
    const followerCount = Number(followerRow?.n ?? 0);

    const { shareFollowing: _shareFollowing, invitePermission, ...publicProfile } = profile;
    res.json({
      profile: publicProfile, connectionStatus, connectionId, isOwn, covenCount, followerCount,
      isFollowing: !!following, canViewFollowing, canRequestCoven: invitePermission !== 'nobody',
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'profile.get.error', msg: String(err).slice(0, 400) }));
    res.status(500).json({ error: 'Failed to load profile' });
  }
}