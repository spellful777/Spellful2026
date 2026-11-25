/**
 * GET /api/admin/command-center/settings
 * Owner-only: platform config + role definitions + email template preview.
 * Query: ?view=config|roles|email-preview
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq, count } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';
import { buildEmailHtml } from '@/server/lib/email-template.js';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = path.resolve('/private/spellful-platform-config.json');

export interface PlatformConfig {
  registrationOpen: boolean;
  requireEmailVerification: boolean;
  plusEnabled: boolean;
  communityEnabled: boolean;
  messagingEnabled: boolean;
  maintenanceMode: boolean;
}

const DEFAULT_CONFIG: PlatformConfig = {
  registrationOpen: true,
  requireEmailVerification: true,
  plusEnabled: true,
  communityEnabled: true,
  messagingEnabled: true,
  maintenanceMode: false,
};

export async function readConfig(): Promise<PlatformConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as PlatformConfig;
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  const view = typeof req.query.view === 'string' ? req.query.view : 'config';

  if (view === 'roles') {
    // Role hierarchy + member counts per role
    const roles = ['admin', 'admin', 'moderator', 'support', 'member'] as const;
    const counts = await Promise.all(
      roles.map(r =>
        db!.select({ n: count() }).from(user).where(eq(user.platformRole, r))
      )
    );
    return res.json({
      roles: roles.map((r, i) => ({
        role: r,
        count: Number(counts[i][0]?.n ?? 0),
        description: ROLE_DESCRIPTIONS[r],
        permissions: ROLE_PERMISSIONS[r],
      })),
    });
  }

  if (view === 'email-preview') {
    const template = req.query.template as string | undefined;
    const html = buildEmailHtml(EMAIL_PREVIEWS[template ?? 'welcome'] ?? EMAIL_PREVIEWS.welcome);
    return res.json({ html });
  }

  // Default: config
  const config = await readConfig();
  return res.json({ config });
}

// ── Role metadata ─────────────────────────────────────────────────────────────
const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner:     'Full platform access. Can manage all roles, config, and billing.',
  admin:     'Manage members, content, and community. Cannot change owner settings.',
  moderator: 'Review and action community reports. Cannot change member roles.',
  support:   'Read-only access to member profiles and support queue.',
  member:    'Standard community member. No admin access.',
};

const ROLE_PERMISSIONS: Record<string, string[]> = {
  owner:     ['All permissions'],
  admin:     ['Manage members', 'Manage content', 'View analytics', 'Manage community'],
  moderator: ['Action reports', 'Hide/pin/lock posts', 'View member profiles'],
  support:   ['View member profiles', 'View support queue'],
  member:    ['Community access', 'Messaging', 'Grimoire', 'Profile'],
};

// ── Email preview templates ───────────────────────────────────────────────────
const EMAIL_PREVIEWS: Record<string, Parameters<typeof buildEmailHtml>[0]> = {
  welcome: {
    heading: "Welcome to Spellful! ✨",
    paragraphs: [
      "We are so glad you are here! From all of us on the Spellful Team, thank you for joining our community.",
      "Explore your daily horoscope, moon calendar, tarot readings, and more.",
    ],
    cta: { label: "Explore Spellful", url: "https://spellful.com" },
    footerNote: "You received this because you created a Spellful account.",
  },
  verification: {
    heading: "Verify your email address",
    paragraphs: [
      "Thanks for signing up for Spellful. Please verify your email address to complete your account setup.",
    ],
    cta: { label: "Verify Email", url: "https://spellful.com/verify?token=PREVIEW" },
    footerNote: "If you did not create an account, you can safely ignore this email.",
  },
  "password-reset": {
    heading: "Reset your password",
    paragraphs: [
      "We received a request to reset the password for your Spellful account.",
      "Click the button below to choose a new password. This link expires in 1 hour.",
    ],
    cta: { label: "Reset Password", url: "https://spellful.com/reset?token=PREVIEW" },
    footerNote: "If you did not request a password reset, you can safely ignore this email.",
  },
};
