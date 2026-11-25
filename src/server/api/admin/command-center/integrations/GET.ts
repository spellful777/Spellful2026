/**
 * GET /api/admin/command-center/integrations
 * Owner-only: live status for every platform integration.
 * Checks secrets presence, DB-backed OAuth account counts, push sub count,
 * and Apple webhook registration state.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { account, pushSubscriptions } from '@/server/db/schema.js';
import { eq, count } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { hasRole } from '@/server/lib/require-role.js';
import { getSecret } from '#airo/secrets';

type IntegrationStatus = 'ok' | 'warning' | 'error' | 'pending';

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  note: string;
  detail?: string;
  docUrl?: string;
}

export default async function handler(req: Request, res: Response) {
  const session = await getAuthSession(req);
  if (!session?.user?.id || !hasRole(session as { user?: Record<string, unknown> }, 'admin')) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  // ── Secret presence checks ─────────────────────────────────────────────────
  const googleClientId     = getSecret('GOOGLE_CLIENT_ID');
  const googleClientSecret = getSecret('GOOGLE_CLIENT_SECRET');
  const appleClientId      = getSecret('APPLE_CLIENT_ID');
  const appleClientSecret  = getSecret('APPLE_CLIENT_SECRET');
  const appleAppId = Number(getSecret('APPLE_APP_ID'));
  const purchaseVerifierConfigured = process.env.APPLE_STORE_ENVIRONMENT === 'Sandbox' || (Number.isSafeInteger(appleAppId) && appleAppId > 0);
  const vapidPublic        = getSecret('VAPID_PUBLIC_KEY');
  const vapidPrivate       = getSecret('VAPID_PRIVATE_KEY');
  const betterAuthSecret   = getSecret('BETTER_AUTH_SECRET');
  const codemagicToken     = getSecret('CODEMAGIC_API_TOKEN');

  // ── DB counts ─────────────────────────────────────────────────────────────
  const [googleAccounts, appleAccounts, pushSubCount] = await Promise.all([
    db.select({ n: count() }).from(account).where(eq(account.providerId, 'google')),
    db.select({ n: count() }).from(account).where(eq(account.providerId, 'apple')),
    db.select({ n: count() }).from(pushSubscriptions),
  ]);

  const googleUserCount = Number(googleAccounts[0]?.n ?? 0);
  const appleUserCount  = Number(appleAccounts[0]?.n ?? 0);
  const pushCount       = Number(pushSubCount[0]?.n ?? 0);

  // ── Build integration list ─────────────────────────────────────────────────
  const integrations: IntegrationItem[] = [

    // ── Auth / OAuth ──────────────────────────────────────────────────────────
    {
      id: 'google-oauth',
      name: 'Google OAuth',
      category: 'Auth',
      status: googleClientId && googleClientSecret ? 'ok' : googleClientId ? 'warning' : 'error',
      note: googleClientId && googleClientSecret
        ? `Active — ${googleUserCount} user${googleUserCount !== 1 ? 's' : ''} signed in with Google`
        : googleClientId
        ? 'GOOGLE_CLIENT_SECRET missing'
        : 'GOOGLE_CLIENT_ID not set',
      detail: googleClientId ? `${googleUserCount} Google-linked account${googleUserCount !== 1 ? 's' : ''} in DB` : undefined,
      docUrl: 'https://console.cloud.google.com/apis/credentials',
    },
    {
      id: 'apple-siwa',
      name: 'Sign in with Apple',
      category: 'Auth',
      status: appleClientId && appleClientSecret ? 'ok' : 'pending',
      note: appleClientId && appleClientSecret
        ? `Active — ${appleUserCount} user${appleUserCount !== 1 ? 's' : ''} signed in with Apple`
        : 'APPLE_CLIENT_ID / APPLE_CLIENT_SECRET not set',
      detail: appleClientId && appleClientSecret
        ? `${appleUserCount} Apple-linked account${appleUserCount !== 1 ? 's' : ''} in DB`
        : 'Add secrets to enable SIWA',
      docUrl: 'https://developer.apple.com/account/resources/identifiers/list/serviceId',
    },
    {
      id: 'better-auth',
      name: 'BetterAuth (session)',
      category: 'Auth',
      status: betterAuthSecret ? 'ok' : 'error',
      note: betterAuthSecret ? 'BETTER_AUTH_SECRET configured' : 'BETTER_AUTH_SECRET missing — auth is broken',
      docUrl: 'https://www.better-auth.com/docs',
    },

    // ── Business integrations ─────────────────────────────────────────────────
    {
      id: 'facebook-business',
      name: 'Facebook Business Page',
      category: 'Business',
      status: 'pending',
      note: 'OAuth connection not yet completed',
      detail: 'Retry OAuth from Settings → Integrations',
      docUrl: 'https://developers.facebook.com/apps',
    },
    {
      id: 'gbp-oauth',
      name: 'Google Business Profile',
      category: 'Business',
      status: 'pending',
      note: 'GBP OAuth connection pending',
      detail: 'Connect via Settings → Integrations',
      docUrl: 'https://business.google.com',
    },

    // ── Push / Notifications ──────────────────────────────────────────────────
    {
      id: 'vapid-push',
      name: 'VAPID Push Notifications',
      category: 'Notifications',
      status: vapidPublic && vapidPrivate ? 'ok' : 'error',
      note: vapidPublic && vapidPrivate
        ? `Active — ${pushCount.toLocaleString()} active push subscription${pushCount !== 1 ? 's' : ''}`
        : 'VAPID keys missing — push notifications disabled',
      detail: vapidPublic && vapidPrivate ? `${pushCount} device${pushCount !== 1 ? 's' : ''} subscribed` : undefined,
      docUrl: 'https://web.dev/push-notifications-overview/',
    },

    // ── Apple IAP / Webhooks ──────────────────────────────────────────────────
    {
      id: 'apple-iap-webhook',
      name: 'Apple App Store Notifications',
      category: 'Payments',
      status: purchaseVerifierConfigured ? 'ok' : 'warning',
      note: purchaseVerifierConfigured
        ? 'App Store signature verifier configured'
        : 'Set the numeric APPLE_APP_ID for production signature verification',
      detail: 'Register https://spellful.com/api/plus/apple-notify in App Store Connect',
      docUrl: 'https://developer.apple.com/documentation/appstoreservernotifications',
    },
    {
      id: 'apple-iap-product',
      name: 'IAP Product (com.spellful.plus.monthly)',
      category: 'Payments',
      status: 'pending',
      note: 'Product not yet created in App Store Connect',
      detail: 'Create auto-renewable subscription in App Store Connect → In-App Purchases',
      docUrl: 'https://appstoreconnect.apple.com',
    },

    // ── CI/CD ─────────────────────────────────────────────────────────────────
    {
      id: 'codemagic',
      name: 'Codemagic CI/CD',
      category: 'CI/CD',
      status: codemagicToken ? 'ok' : 'pending',
      note: codemagicToken
        ? 'CODEMAGIC_API_TOKEN set — populate app-store-connect env group to trigger build'
        : 'CODEMAGIC_API_TOKEN not set — populate app-store-connect env group',
      detail: 'Env group: app-store-connect (KEY_ID, ISSUER_ID, KEY_FILE_BASE64)',
      docUrl: 'https://docs.codemagic.io/yaml-code-signing/signing-ios/',
    },
  ];

  // Group by category
  const categories = Array.from(new Set(integrations.map(i => i.category)));
  const grouped = categories.map(cat => ({
    category: cat,
    items: integrations.filter(i => i.category === cat),
  }));

  const summary = {
    total: integrations.length,
    ok:      integrations.filter(i => i.status === 'ok').length,
    warning: integrations.filter(i => i.status === 'warning').length,
    error:   integrations.filter(i => i.status === 'error').length,
    pending: integrations.filter(i => i.status === 'pending').length,
  };

  return res.json({ grouped, summary });
}
