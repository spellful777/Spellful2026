/**
 * PATCH /api/account/profile
 * Saves the authenticated user's own profile data from the account settings page.
 * Username changes are routed through the username/change logic (cooldown enforced
 * only when the user already has a username — first-time set is always allowed).
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user, usernameHistory } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import {
  validateUsernameFormat,
  normalizeUsername,
  usernameErrorMessage,
  USERNAME_COOLDOWN_MS,
} from '@/server/lib/username-rules.js';

export default async function handler(req: Request, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });
  const session = await getAuthSession(req);
  if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
  const myId = session.user.id;

  const body = req.body as {
    username?: string;
    name?: string;
    bio?: string;
    location?: string;
    witchPath?: string;
    visibility?: string;
    sunSign?: string;
    moonSign?: string;
    risingSign?: string;
  };

  const [me] = await db
    .select({
      username: user.username,
      usernameNormalized: user.usernameNormalized,
      usernameChangedAt: user.usernameChangedAt,
    })
    .from(user)
    .where(eq(user.id, myId))
    .limit(1);
  if (!me) return res.status(404).json({ error: 'User not found' });

  const update: Record<string, unknown> = {};

  // ── Username ──────────────────────────────────────────────────────────────
  if (body.username !== undefined) {
    const newUsername = body.username.trim();

    if (newUsername === '') {
      // Allow clearing only if they never had one (shouldn't happen, but safe)
    } else {
      const fmtErr = validateUsernameFormat(newUsername);
      if (fmtErr) return res.status(400).json({ error: usernameErrorMessage(fmtErr), code: fmtErr });

      const normalized = normalizeUsername(newUsername);

      // No-op if unchanged
      if (normalized !== me.usernameNormalized) {
        // Cooldown only applies when the user already has a username set
        if (me.username && me.usernameChangedAt) {
          const elapsed = Date.now() - new Date(me.usernameChangedAt).getTime();
          if (elapsed < USERNAME_COOLDOWN_MS) {
            const daysLeft = Math.ceil((USERNAME_COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
            return res.status(429).json({
              error: `You can change your username again in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
              code: 'cooldown',
              daysLeft,
            });
          }
        }

        // Uniqueness check
        const [existing] = await db
          .select({ id: user.id })
          .from(user)
          .where(eq(user.usernameNormalized, normalized))
          .limit(1);
        if (existing && existing.id !== myId)
          return res.status(409).json({ error: usernameErrorMessage('taken'), code: 'taken' });

        // Archive old username if they had one
        if (me.username && me.usernameNormalized) {
          await db.insert(usernameHistory).values({
            userId: myId,
            oldUsername: me.username,
            oldUsernameNormalized: me.usernameNormalized,
          });
        }

        update.username = newUsername;
        update.usernameNormalized = normalized;
        update.usernameChangedAt = new Date();
      }
    }
  }

  // ── Other fields ──────────────────────────────────────────────────────────
  if (body.name !== undefined) update.name = body.name.slice(0, 80);
  if (body.bio !== undefined) {
    if (body.bio.length > 160) return res.status(400).json({ error: 'Bio must be 160 characters or less' });
    update.bio = body.bio;
  }
  if (body.location !== undefined) update.location = body.location.slice(0, 100);
  if (body.witchPath !== undefined) update.witchPath = body.witchPath.slice(0, 80);
  if (body.visibility !== undefined) {
    if (!['public', 'coven', 'private'].includes(body.visibility))
      return res.status(400).json({ error: 'Invalid visibility' });
    update.profileVisibility = body.visibility;
  }
  const VALID_SIGNS = ['', 'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
  if (body.sunSign !== undefined) {
    if (!VALID_SIGNS.includes(body.sunSign)) return res.status(400).json({ error: 'Invalid sunSign' });
    update.sunSign = body.sunSign;
  }
  if (body.moonSign !== undefined) {
    if (!VALID_SIGNS.includes(body.moonSign)) return res.status(400).json({ error: 'Invalid moonSign' });
    update.moonSign = body.moonSign;
  }
  if (body.risingSign !== undefined) {
    if (!VALID_SIGNS.includes(body.risingSign)) return res.status(400).json({ error: 'Invalid risingSign' });
    update.risingSign = body.risingSign;
  }

  if (Object.keys(update).length > 0) {
    await db.update(user).set(update).where(eq(user.id, myId));
  }

  res.json({ ok: true });
}
