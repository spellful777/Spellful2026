import { postAudienceAllows } from '@/server/lib/community-post-access.js';
import { profileActivity } from '@/server/lib/profile-activity.js';
import { profileAudience } from '@/server/lib/profile-audience.js';
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, covenConnections, communityBlocks, userFollows, communityPosts, profilePlaylists, profileSoundscapesSettings } from '@/server/db/schema.js';
import { eq, and, or, count, desc, isNotNull, sql } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';

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
        featuredAbout: user.featuredAbout,
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
        memberId ? eq(user.id, memberId) : or(
          eq(user.usernameNormalized, normalized),
          sql`(username_normalized IS NULL AND LOWER(username) = ${normalized})`,
        )
      )
      .limit(1);

    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const access = await profileAudience(profile, viewerId, req.query.preview);
    if (!access) return res.status(404).json({ error: 'Profile unavailable' });
    if (!access.allowed) return res.status(403).json({ error: profile.profileVisibility === 'coven' ? 'This profile is coven-only' : 'This profile is private' });
    const tab = req.query.activity;
    if (tab === 'sparks' || tab === 'replies' || tab === 'media') {
      const before = Number(req.query.before);
      return res.json(await profileActivity(profile.id, access, viewerId, tab, Number.isSafeInteger(before) && before > 0 ? before : 0));
    }
    const isOwn = access.owner;
    const canViewFollowing = isOwn || !!profile.shareFollowing;
    if (req.query.following === '1' || req.query.followers === '1') {
      const followers = req.query.followers === '1';
      const listViewer = access.preview ? null : viewerId;
      if (!followers && !canViewFollowing) return res.status(403).json({ error: 'Following list is private' });

      const pageSize = 30;
      const before = Number(req.query.before);
      const entries = await db
        .select({ followId: userFollows.id, username: user.username, name: user.name, image: user.image })
        .from(userFollows)
        .innerJoin(user, eq(user.id, followers ? userFollows.followerId : userFollows.followingId))
        .where(and(
          eq(followers ? userFollows.followingId : userFollows.followerId, profile.id),
          isNotNull(user.username),
          Number.isSafeInteger(before) && before > 0 ? sql`${userFollows.id} < ${before}` : undefined,
          or(
            eq(user.profileVisibility, 'public'),
            listViewer ? eq(user.id, listViewer) : undefined,
            listViewer ? and(eq(user.profileVisibility, 'coven'), sql`exists (
              select 1 from ${covenConnections} where ${covenConnections.status} = 'accepted' and (
                (${covenConnections.requesterId} = ${listViewer} and ${covenConnections.receiverId} = ${user.id}) or
                (${covenConnections.receiverId} = ${listViewer} and ${covenConnections.requesterId} = ${user.id})
              )
            )`) : undefined,
          ),
          listViewer ? sql`not exists (
            select 1 from ${communityBlocks} where
              (${communityBlocks.blockerId} = ${listViewer} and ${communityBlocks.blockedId} = ${user.id}) or
              (${communityBlocks.blockedId} = ${listViewer} and ${communityBlocks.blockerId} = ${user.id})
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

    const conn = access.connection;
    const connectionStatus = conn?.status === 'pending'
      ? conn.requesterId === viewerId ? 'pending_sent' : 'pending_received'
      : conn?.status ?? (access.coven ? 'accepted' : null);
    const connectionId = conn?.id ?? null;

    // Coven count (accepted connections)
    const [[covenRow], [followerRow], [following], [followingRow]] = await Promise.all([
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
      db.select({ n: count() }).from(userFollows).where(eq(userFollows.followerId, profile.id)),
    ]);
    const covenCount = Number(covenRow?.n ?? 0);
    const followerCount = Number(followerRow?.n ?? 0);

    const selected = profile.featuredAbout;
    let featuredAbout = selected;
    if (selected?.kind === 'playlist' && !access.owner) {
      const [item] = await db.select({ visibility: profilePlaylists.visibility, sectionVisibility: profileSoundscapesSettings.visibility })
        .from(profilePlaylists).innerJoin(profileSoundscapesSettings, eq(profileSoundscapesSettings.userId, profile.id))
        .where(and(eq(profilePlaylists.id, selected.id), eq(profilePlaylists.userId, profile.id), eq(profileSoundscapesSettings.enabled, 1))).limit(1);
      if (!item || !access.allows(item.visibility ?? 'private') || !access.allows(item.sectionVisibility ?? 'private')) featuredAbout = null;
    }
    if (selected?.kind === 'spark') {
      const [spark] = await db.select({ audience: communityPosts.audience }).from(communityPosts).where(and(
        eq(communityPosts.id, selected.id), eq(communityPosts.userId, profile.id),
        eq(communityPosts.type, 'spark'), eq(communityPosts.isHidden, false))).limit(1);
      if (!spark || !access.allows(spark.audience)) featuredAbout = null;
    }
    const { shareFollowing: _shareFollowing, invitePermission, ...publicProfile } = profile;
    const latestPosts = await db.select({
      id: communityPosts.id, title: communityPosts.title, createdAt: communityPosts.createdAt,
    }).from(communityPosts).where(and(
      eq(communityPosts.userId, profile.id), eq(communityPosts.isHidden, false),
      access.preview && access.coven
        ? or(eq(communityPosts.audience, 'public'), eq(communityPosts.audience, 'coven'))
        : postAudienceAllows(access.preview ? undefined : viewerId ?? undefined),
    )).orderBy(desc(communityPosts.createdAt), desc(communityPosts.id)).limit(4);
    res.json({
      latestPosts,
      profile: {
        ...publicProfile, featuredAbout,
        interestTags: !isOwn && profile.profileSections?.some(section => section.id === 'interests' && !section.enabled) ? null : profile.interestTags,
        bio: access.allows(profile.bioVisibility) ? profile.bio : null,
        location: access.allows(profile.locationVisibility) ? profile.location : null,
        sunSign: access.allows(profile.zodiacVisibility) ? profile.sunSign : null,
        moonSign: access.allows(profile.zodiacVisibility) ? profile.moonSign : null,
        risingSign: access.allows(profile.zodiacVisibility) ? profile.risingSign : null,
        socialLinks: access.allows(profile.socialLinksVisibility) ? profile.socialLinks : null,
      },
      connectionStatus, connectionId, isOwn, covenCount, followerCount,
      followingCount: Number(followingRow?.n ?? 0),
      isFollowing: !!following, canViewFollowing, canRequestCoven: invitePermission !== 'nobody',
    });
  } catch (err) {
    console.error(JSON.stringify({ event: 'profile.get.error', msg: String(err).slice(0, 400) }));
    res.status(500).json({ error: 'Failed to load profile' });
  }
}