/**
 * Spellful Moments — Daily Lifecycle Email Scheduler
 *
 * Runs once at server boot, then every 24 hours.
 * For each occasion today (birthdays, new/full moons, sabbats, re-engagement),
 * resolves eligible members, checks consent, deduplicates, dispatches email,
 * and records the outcome in moments_email_sends.
 *
 * Safe to run multiple times per day — dedup key prevents double-sends.
 * Configurable pause via moments_scheduler_state.paused = true.
 */

import { db } from '@/server/db/client.js';
import { sql } from 'drizzle-orm';
import { sendEmail } from '@/server/lib/send-email.js';
import { getEntitlement } from '@/server/lib/plus-entitlement.js';
import { createMomentsToken } from '@/server/lib/moments-tokens.js';
import {
  todayUtcIso,
  currentQuarter,
  isBirthdayToday,
  birthdayDedupKey,
  moonDedupKey,
  sabbatDedupKey,
  reEngagementDedupKey,
  anniversaryDedupKey,
  discoveryDedupKey,
  getOccasionsForDate,
} from '@/server/lib/moments-calendar.js';
import {
  buildBirthdayEmail,
  buildNewMoonEmail,
  buildFullMoonEmail,
  buildSabbatEmail,
  buildReEngagementEmail,
  buildAnniversaryEmail,
  buildDiscoveryEmail,
} from '@/server/lib/moments-templates.js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EligibleUser {
  id: string;
  name: string | null;
  email: string;
  birthDate: string | null;
  lastLoginAt: Date | null;
  joinedAt: Date | null;
}

interface ConsentRow {
  userId: string;
  category: string;
  consented: boolean;
}

// ─── Consent helper ───────────────────────────────────────────────────────────

/** Returns a map of userId -> Set<category> for all consented rows */
async function loadConsent(userIds: string[]): Promise<Map<string, Set<string>>> {
  if (!db || userIds.length === 0) return new Map();
  const placeholders = userIds.map(() => '?').join(',');
  const [rows] = await db.execute<ConsentRow>(
    sql`SELECT user_id AS userId, category, consented
        FROM marketing_consent
        WHERE user_id IN (${sql.raw(placeholders)}) AND consented = TRUE`,
  );
  const map = new Map<string, Set<string>>();
  for (const row of rows as ConsentRow[]) {
    if (!map.has(row.userId)) map.set(row.userId, new Set());
    map.get(row.userId)!.add(row.category);
  }
  return map;
}

/** Returns true if the user has consented to a given category */
function hasConsent(consentMap: Map<string, Set<string>>, userId: string, category: string): boolean {
  return consentMap.get(userId)?.has(category) ?? false;
}

// ─── Dedup helper ─────────────────────────────────────────────────────────────

/** Returns a set of "userId:dedupKey" strings that have already been sent/queued */
async function loadSentDedup(userIds: string[], dedupKeys: string[]): Promise<Set<string>> {
  if (!db || userIds.length === 0 || dedupKeys.length === 0) return new Set();
  const uPlaceholders = userIds.map(() => '?').join(',');
  const dPlaceholders = dedupKeys.map(() => '?').join(',');
  const [rows] = await db.execute<{ user_id: string; dedup_key: string }>(
    sql`SELECT user_id, dedup_key FROM moments_email_sends
        WHERE user_id IN (${sql.raw(uPlaceholders)})
          AND dedup_key IN (${sql.raw(dPlaceholders)})
          AND status IN ('queued','sent')`,
  );
  const set = new Set<string>();
  for (const row of rows as { user_id: string; dedup_key: string }[]) {
    set.add(`${row.user_id}:${row.dedup_key}`);
  }
  return set;
}

// ─── Record send outcome ──────────────────────────────────────────────────────

async function recordSend(opts: {
  userId: string;
  occasion: string;
  dedupKey: string;
  variant: string;
  status: 'sent' | 'failed' | 'skipped';
  messageId?: string;
  errorMessage?: string;
  includedPlusCta: boolean;
  scheduledFor: string;
}): Promise<void> {
  if (!db) return;
  try {
    await db.execute(
      sql`INSERT IGNORE INTO moments_email_sends
          (user_id, occasion, dedup_key, template_variant, status, message_id, error_message,
           included_plus_cta, scheduled_for, sent_at)
          VALUES (${opts.userId}, ${opts.occasion}, ${opts.dedupKey}, ${opts.variant},
                  ${opts.status}, ${opts.messageId ?? null}, ${opts.errorMessage ?? null},
                  ${opts.includedPlusCta ? 1 : 0}, ${opts.scheduledFor},
                  ${opts.status === 'sent' ? new Date() : null})`,
    );
  } catch {
    // Duplicate key = already recorded; safe to ignore
  }
}

// ─── Variant selector ─────────────────────────────────────────────────────────

/** Deterministic variant selection based on userId hash — same user always gets same variant */
function pickVariant<T extends string>(userId: string, variants: T[]): T {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return variants[hash % variants.length]!;
}

// ─── Main run function ────────────────────────────────────────────────────────

export async function runMomentsScheduler(): Promise<{
  date: string;
  sent: number;
  skipped: number;
  errors: number;
}> {
  if (!db) {
    console.error(JSON.stringify({ event: 'moments.scheduler.no_db' }));
    return { date: todayUtcIso(), sent: 0, skipped: 0, errors: 0 };
  }

  const today = todayUtcIso();
  const year = parseInt(today.slice(0, 4), 10);
  const quarter = currentQuarter();

  // ── Check pause flag and dedup for today ──────────────────────────────────
  const [stateRows] = await db.execute<{
    paused: number;
    last_run_date: string | null;
  }>(sql`SELECT paused, last_run_date FROM moments_scheduler_state WHERE id = 1 LIMIT 1`);

  const state = (stateRows as { paused: number; last_run_date: string | null }[])[0];
  if (state?.paused) {
    console.log(JSON.stringify({ event: 'moments.scheduler.paused', date: today }));
    return { date: today, sent: 0, skipped: 0, errors: 0 };
  }
  if (state?.last_run_date === today) {
    console.log(JSON.stringify({ event: 'moments.scheduler.already_ran', date: today }));
    return { date: today, sent: 0, skipped: 0, errors: 0 };
  }

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  let errorDetail = '';

  try {
    // ── Load all eligible users (email verified, not deleted) ────────────────
    const [userRows] = await db.execute<EligibleUser>(
      sql`SELECT u.id, u.name, u.email, u.birth_date AS birthDate,
                 u.created_at AS joinedAt,
                 s.created_at AS lastLoginAt
          FROM \`user\` u
          LEFT JOIN session s ON s.user_id = u.id
            AND s.created_at = (SELECT MAX(s2.created_at) FROM session s2 WHERE s2.user_id = u.id)
          WHERE u.email_verified = TRUE
            AND u.deletion_requested_at IS NULL
          GROUP BY u.id`,
    );
    const users = userRows as EligibleUser[];
    if (users.length === 0) {
      await updateSchedulerState(today, 0, 0, 0, null);
      return { date: today, sent: 0, skipped: 0, errors: 0 };
    }

    const userIds = users.map(u => u.id);

    // ── Determine today's occasions ──────────────────────────────────────────
    const { moonEvents, sabbats } = getOccasionsForDate(today);
    const birthdayDedupK = birthdayDedupKey(year);
    const reEngageDedupK = reEngagementDedupKey(year, quarter);
    const anniversaryDedupK = anniversaryDedupKey(year);
    const discoveryDedupK = discoveryDedupKey(year, quarter);
    const allDedupKeys = [
      birthdayDedupK,
      reEngageDedupK,
      anniversaryDedupK,
      discoveryDedupK,
      ...moonEvents.map(e => moonDedupKey(e.type, e.date)),
      ...sabbats.map(s => sabbatDedupKey(s.name, year)),
    ];

    // ── Load consent + dedup in parallel ────────────────────────────────────
    const [consentMap, sentDedup] = await Promise.all([
      loadConsent(userIds),
      loadSentDedup(userIds, allDedupKeys),
    ]);

    // ── Process each user ────────────────────────────────────────────────────
    for (const user of users) {
      const userId = user.id;
      const name = user.name ?? user.email.split('@')[0] ?? 'friend';
      const email = user.email;

      // Generate unsubscribe token once per user (reused across all sends today)
      let token: string;
      try {
        token = await createMomentsToken(userId, 'unsubscribe');
      } catch {
        errors++;
        continue;
      }

      // Check Plus entitlement once per user
      let isPlus = false;
      try {
        const ent = await getEntitlement(userId);
        isPlus = ent.isPlus;
      } catch {
        // Non-fatal — treat as free member
      }

      const plusCtaConsented = hasConsent(consentMap, userId, 'plus_offers');

      // ── Birthday ────────────────────────────────────────────────────────
      if (
        user.birthDate &&
        isBirthdayToday(user.birthDate, today) &&
        hasConsent(consentMap, userId, 'birthday') &&
        !sentDedup.has(`${userId}:${birthdayDedupK}`)
      ) {
        const variant = pickVariant(userId, ['a', 'b', 'c'] as const);
        const tpl = buildBirthdayEmail({ name, variant, token, isPlus, plusCtaConsented });
        try {
          const result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, fromName: 'Spellful' });
          await recordSend({ userId, occasion: 'birthday', dedupKey: birthdayDedupK, variant, status: 'sent', messageId: result.messageId, includedPlusCta: !isPlus && plusCtaConsented, scheduledFor: today });
          sent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await recordSend({ userId, occasion: 'birthday', dedupKey: birthdayDedupK, variant, status: 'failed', errorMessage: msg.slice(0, 500), includedPlusCta: false, scheduledFor: today });
          errors++;
          errorDetail = msg.slice(0, 200);
        }
      }

      // ── Moon events ─────────────────────────────────────────────────────
      for (const moonEvent of moonEvents) {
        const dedupK = moonDedupKey(moonEvent.type, moonEvent.date);
        if (
          hasConsent(consentMap, userId, 'moon_seasonal') &&
          !sentDedup.has(`${userId}:${dedupK}`)
        ) {
          const variant = pickVariant(userId, ['a', 'b'] as const);
          const tpl = moonEvent.type === 'new_moon'
            ? buildNewMoonEmail({ name, moonName: moonEvent.name, variant, token, isPlus, plusCtaConsented })
            : buildFullMoonEmail({ name, moonName: moonEvent.name, variant, token, isPlus, plusCtaConsented });
          try {
            const result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, fromName: 'Spellful' });
            await recordSend({ userId, occasion: moonEvent.type, dedupKey: dedupK, variant, status: 'sent', messageId: result.messageId, includedPlusCta: !isPlus && plusCtaConsented, scheduledFor: today });
            sent++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await recordSend({ userId, occasion: moonEvent.type, dedupKey: dedupK, variant, status: 'failed', errorMessage: msg.slice(0, 500), includedPlusCta: false, scheduledFor: today });
            errors++;
            errorDetail = msg.slice(0, 200);
          }
        } else {
          skipped++;
        }
      }

      // ── Sabbats ─────────────────────────────────────────────────────────
      for (const sabbat of sabbats) {
        const dedupK = sabbatDedupKey(sabbat.name, year);
        if (
          hasConsent(consentMap, userId, 'moon_seasonal') &&
          !sentDedup.has(`${userId}:${dedupK}`)
        ) {
          const variant = pickVariant(userId, ['a', 'b'] as const);
          const tpl = buildSabbatEmail({ name, sabbatName: sabbat.name, sabbatDescription: sabbat.description, variant, token, isPlus, plusCtaConsented });
          try {
            const result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, fromName: 'Spellful' });
            await recordSend({ userId, occasion: 'sabbat', dedupKey: dedupK, variant, status: 'sent', messageId: result.messageId, includedPlusCta: !isPlus && plusCtaConsented, scheduledFor: today });
            sent++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await recordSend({ userId, occasion: 'sabbat', dedupKey: dedupK, variant, status: 'failed', errorMessage: msg.slice(0, 500), includedPlusCta: false, scheduledFor: today });
            errors++;
            errorDetail = msg.slice(0, 200);
          }
        } else {
          skipped++;
        }
      }

      // ── Membership Anniversary (annual, 1+ years) ────────────────────────
      const joined = user.joinedAt ? new Date(user.joinedAt) : null;
      if (joined) {
        const joinedIso = joined.toISOString().slice(0, 10);
        const joinMonth = joinedIso.slice(5, 7);
        const joinDay = joinedIso.slice(8, 10);
        const todayMD = today.slice(5);
        const yearsAsMember = year - parseInt(joinedIso.slice(0, 4), 10);
        if (
          yearsAsMember >= 1 &&
          `${joinMonth}-${joinDay}` === todayMD &&
          hasConsent(consentMap, userId, 'community') &&
          !sentDedup.has(`${userId}:${anniversaryDedupK}`)
        ) {
          const variant = pickVariant(userId, ['a', 'b'] as const);
          const tpl = buildAnniversaryEmail({ name, years: yearsAsMember, variant, token, isPlus, plusCtaConsented });
          try {
            const result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, fromName: 'Spellful' });
            await recordSend({ userId, occasion: 'anniversary', dedupKey: anniversaryDedupK, variant, status: 'sent', messageId: result.messageId, includedPlusCta: !isPlus && plusCtaConsented, scheduledFor: today });
            sent++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            await recordSend({ userId, occasion: 'anniversary', dedupKey: anniversaryDedupK, variant, status: 'failed', errorMessage: msg.slice(0, 500), includedPlusCta: false, scheduledFor: today });
            errors++;
            errorDetail = msg.slice(0, 200);
          }
        }
      }

      // ── Feature Discovery (quarterly, for users joined > 7 days ago) ─────
      if (
        joined &&
        Math.floor((Date.now() - joined.getTime()) / 86_400_000) > 7 &&
        hasConsent(consentMap, userId, 'discovery') &&
        !sentDedup.has(`${userId}:${discoveryDedupK}`)
      ) {
        const variant = pickVariant(userId, ['a', 'b'] as const);
        const tpl = buildDiscoveryEmail({ name, variant, token, isPlus, plusCtaConsented });
        try {
          const result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, fromName: 'Spellful' });
          await recordSend({ userId, occasion: 'discovery', dedupKey: discoveryDedupK, variant, status: 'sent', messageId: result.messageId, includedPlusCta: !isPlus && plusCtaConsented, scheduledFor: today });
          sent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await recordSend({ userId, occasion: 'discovery', dedupKey: discoveryDedupK, variant, status: 'failed', errorMessage: msg.slice(0, 500), includedPlusCta: false, scheduledFor: today });
          errors++;
          errorDetail = msg.slice(0, 200);
        }
      }

      // ── Re-engagement (quarterly, for users inactive > 30 days) ─────────
      const lastLogin = user.lastLoginAt ? new Date(user.lastLoginAt) : null;
      const daysSinceLogin = lastLogin
        ? Math.floor((Date.now() - lastLogin.getTime()) / 86_400_000)
        : 999;
      if (
        daysSinceLogin > 30 &&
        hasConsent(consentMap, userId, 'community') &&
        !sentDedup.has(`${userId}:${reEngageDedupK}`)
      ) {
        const variant = pickVariant(userId, ['a', 'b'] as const);
        const tpl = buildReEngagementEmail({ name, variant, token, isPlus, plusCtaConsented });
        try {
          const result = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text, fromName: 'Spellful' });
          await recordSend({ userId, occasion: 're_engagement', dedupKey: reEngageDedupK, variant, status: 'sent', messageId: result.messageId, includedPlusCta: !isPlus && plusCtaConsented, scheduledFor: today });
          sent++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await recordSend({ userId, occasion: 're_engagement', dedupKey: reEngageDedupK, variant, status: 'failed', errorMessage: msg.slice(0, 500), includedPlusCta: false, scheduledFor: today });
          errors++;
          errorDetail = msg.slice(0, 200);
        }
      }
    }
  } catch (err) {
    errorDetail = err instanceof Error ? err.message.slice(0, 200) : String(err).slice(0, 200);
    console.error(JSON.stringify({ event: 'moments.scheduler.fatal', error: errorDetail }));
  }

  await updateSchedulerState(today, sent, skipped, errors, errorDetail || null);

  console.log(JSON.stringify({ event: 'moments.scheduler.complete', date: today, sent, skipped, errors }));
  return { date: today, sent, skipped, errors };
}

async function updateSchedulerState(
  date: string,
  sent: number,
  skipped: number,
  errors: number,
  errorDetail: string | null,
): Promise<void> {
  if (!db) return;
  try {
    await db.execute(
      sql`UPDATE moments_scheduler_state SET
            last_run_at = NOW(),
            last_run_date = ${date},
            last_run_sent_count = ${sent},
            last_run_skip_count = ${skipped},
            last_run_error_count = ${errors},
            last_run_error_detail = ${errorDetail},
            consecutive_fail_days = CASE WHEN ${errors} > 0 THEN consecutive_fail_days + 1 ELSE 0 END
          WHERE id = 1`,
    );
  } catch {
    // Non-fatal
  }
}

// ─── Scheduler boot ───────────────────────────────────────────────────────────

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

export function startMomentsScheduler(): void {
  // Run immediately at boot (with a short delay to let DB settle)
  setTimeout(() => {
    runMomentsScheduler().catch(err => {
      console.error(JSON.stringify({ event: 'moments.scheduler.boot_error', error: String(err) }));
    });
  }, 10_000);

  // Then every 24 hours
  schedulerInterval = setInterval(() => {
    runMomentsScheduler().catch(err => {
      console.error(JSON.stringify({ event: 'moments.scheduler.interval_error', error: String(err) }));
    });
  }, INTERVAL_MS);
}

export function stopMomentsScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
