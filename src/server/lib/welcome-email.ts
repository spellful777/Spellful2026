/**
 * Welcome email system — replaces the old welcome DM.
 *
 * Sends ONE branded welcome email to every newly verified Spellful member.
 * Idempotent: guarded by a unique (userId, eventType) row in email_events.
 * Never blocks account creation or email verification — all errors are caught.
 *
 * States: queued → sent | failed
 * Retries: up to MAX_ATTEMPTS on transient gateway errors.
 */
import { db } from '../db/client.js';
import { emailEvents, user } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { sendEmail } from '../email.js';
import { buildEmailHtml, buildEmailText } from './email-template.js';

const EVENT_TYPE = 'welcome';
const MAX_ATTEMPTS = 3;

const BASE_URL = 'https://spellful.com';
const FEATURE_LINKS: Record<string, string> = {
  horoscope: `${BASE_URL}/horoscope`,
  moon: `${BASE_URL}/moon`,
  tarot: `${BASE_URL}/tarot`,
  grimoire: `${BASE_URL}/grimoire`,
  community: `${BASE_URL}/community`,
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildWelcomeHtml(firstName: string): string {
  const name = escapeHtml(firstName.trim() || 'there');
  return buildEmailHtml({
    heading: `Welcome to Spellful, ${name}! ✨`,
    paragraphs: [
      `We're so glad you're here! From all of us on the Spellful Team, thank you for joining our community. Whether you're exploring astrology, expanding your spiritual practice, or simply discovering a little magic in your everyday life, we're excited to have you with us.`,
      `Here are some wonderful places to start:`,
      `<a href="${FEATURE_LINKS.horoscope}" style="color:#222;text-decoration:none;">🔮 <strong>Daily Horoscopes</strong></a> — Discover insights for your zodiac sign.<br>
<a href="${FEATURE_LINKS.moon}" style="color:#222;text-decoration:none;">🌙 <strong>Moon Calendar</strong></a> — Explore moon phases and lunar events.<br>
<a href="${FEATURE_LINKS.tarot}" style="color:#222;text-decoration:none;">🃏 <strong>Tarot</strong></a> — Explore cards and readings for reflection and inspiration.<br>
<a href="${FEATURE_LINKS.grimoire}" style="color:#222;text-decoration:none;">📖 <strong>Your Grimoire</strong></a> — Keep your notes, discoveries, and personal magical knowledge together.<br>
<a href="${FEATURE_LINKS.community}" style="color:#222;text-decoration:none;">🌿 <strong>Community</strong></a> — Meet fellow members, share ideas, and explore discussions.`,
      `Complete your profile, explore your favorite features, and make Spellful your own. There's no rush — your journey is yours to enjoy.`,
      `With love, light &amp; a little magic,<br><strong>The Spellful Team 💜</strong>`,
    ],
    cta: { label: 'Explore Spellful', url: BASE_URL },
  });
}

function buildWelcomePlainText(firstName: string): string {
  const name = firstName.trim() || 'there';
  return buildEmailText({
    heading: `Welcome to Spellful, ${name}! ✨`,
    paragraphs: [
      `We're so glad you're here! From all of us on the Spellful Team, thank you for joining our community.`,
      `Here are some wonderful places to start:`,
      `🔮 Daily Horoscopes — ${FEATURE_LINKS.horoscope}`,
      `🌙 Moon Calendar — ${FEATURE_LINKS.moon}`,
      `🃏 Tarot — ${FEATURE_LINKS.tarot}`,
      `📖 Your Grimoire — ${FEATURE_LINKS.grimoire}`,
      `🌿 Community — ${FEATURE_LINKS.community}`,
      `Complete your profile and make Spellful your own.`,
      `With love, light & a little magic,\nThe Spellful Team 💜`,
    ],
    cta: { label: 'Explore Spellful', url: BASE_URL },
  });
}

/**
 * Queue and send a welcome email for a newly verified user.
 * Safe to call multiple times — only sends once per user.
 * Never throws — all errors are caught and logged.
 */
export async function sendWelcomeEmail(userId: string): Promise<void> {
  if (!db) return;

  try {
    const [u] = await db
      .select({ email: user.email, name: user.name, emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!u) {
      console.error(JSON.stringify({ event: 'welcome_email.skip', reason: 'user_not_found', userId }));
      return;
    }

    if (!u.emailVerified) {
      console.error(JSON.stringify({ event: 'welcome_email.skip', reason: 'email_not_verified', userId }));
      return;
    }

    // Idempotency guard — check existing record
    const [existing] = await db
      .select({ id: emailEvents.id, status: emailEvents.status, attempts: emailEvents.attempts })
      .from(emailEvents)
      .where(and(eq(emailEvents.userId, userId), eq(emailEvents.eventType, EVENT_TYPE)))
      .limit(1);

    if (existing) {
      if (existing.status === 'sent') return; // already delivered
      if (existing.attempts >= MAX_ATTEMPTS) {
        console.error(JSON.stringify({ event: 'welcome_email.skip', reason: 'max_attempts_reached', userId }));
        return;
      }
      await db
        .update(emailEvents)
        .set({ attempts: existing.attempts + 1, status: 'queued', updatedAt: new Date() })
        .where(eq(emailEvents.id, existing.id));
    } else {
      try {
        await db.insert(emailEvents).values({ userId, eventType: EVENT_TYPE, status: 'queued', attempts: 1 });
      } catch {
        // Duplicate key = concurrent insert — check if already sent
        const [race] = await db
          .select({ status: emailEvents.status })
          .from(emailEvents)
          .where(and(eq(emailEvents.userId, userId), eq(emailEvents.eventType, EVENT_TYPE)))
          .limit(1);
        if (race?.status === 'sent') return;
        console.error(JSON.stringify({ event: 'welcome_email.skip', reason: 'concurrent_insert', userId }));
        return;
      }
    }

    const firstName = (u.name ?? '').split(' ')[0] ?? '';

    let messageId: string | undefined;
    try {
      const result = await sendEmail({
        to: u.email,
        fromName: 'Spellful Team',
        subject: "Welcome to Spellful ✨ We're so glad you're here!",
        html: buildWelcomeHtml(firstName),
        text: buildWelcomePlainText(firstName),
        sameDomainFallback: true,
      });
      messageId = result.messageId;
    } catch (sendErr) {
      const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      await db
        .update(emailEvents)
        .set({ status: 'failed', lastError: errMsg.slice(0, 500), updatedAt: new Date() })
        .where(and(eq(emailEvents.userId, userId), eq(emailEvents.eventType, EVENT_TYPE)));
      console.error(JSON.stringify({ event: 'welcome_email.failed', reason: 'gateway_error', userId }));
      return;
    }

    await db
      .update(emailEvents)
      .set({ status: 'sent', messageId: messageId ?? null, sentAt: new Date(), updatedAt: new Date() })
      .where(and(eq(emailEvents.userId, userId), eq(emailEvents.eventType, EVENT_TYPE)));

    console.log(JSON.stringify({ event: 'welcome_email.sent', userId, messageId }));
  } catch (err) {
    console.error(JSON.stringify({ event: 'welcome_email.error', userId, msg: String(err).slice(0, 200) }));
  }
}
