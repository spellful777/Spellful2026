/**
 * GET /api/community/hearth
 *
 * Returns the Coven Hearth hub payload for today:
 *   qotd        - today's Question of the Day (auto-seeded if missing)
 *   moonEvent   - next upcoming moon phase event (computed, no DB)
 *   featured    - most-liked visible post from the last 7 days
 *   recent      - 4 most-recent visible posts (excluding featured)
 *
 * Auth: optional - unauthenticated callers get the same data.
 */
import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { covenHearthQotd, communityPosts, communityCategories, user } from '@/server/db/schema.js';
import { eq, and, desc, gt, ne } from 'drizzle-orm';
import { runStartupMigration } from '@/server/db/migrate-startup.js';

// -- QOTD seed bank -----------------------------------------------------------
// 60 questions cycling by day-of-year mod 60
const QOTD_BANK: { question: string; prompt?: string; emoji: string }[] = [
  { question: 'What drew you to the craft?', prompt: 'Share your origin story - a moment, a feeling, a sign.', emoji: '🌙' },
  { question: 'Which element do you feel most connected to right now?', prompt: 'Fire, water, earth, or air - and why today?', emoji: '🔥' },
  { question: 'What ritual or practice have you been neglecting?', prompt: 'No judgment - just honest reflection.', emoji: '🕯' },
  { question: 'Describe your altar in three words.', prompt: 'Or the altar you dream of building.', emoji: '✨' },
  { question: 'What crystal is calling to you this week?', prompt: 'Trust your intuition.', emoji: '💎' },
  { question: 'What does your shadow self want you to know?', prompt: 'Shadow work is sacred work.', emoji: '🌑' },
  { question: 'Which tarot card feels like your energy right now?', prompt: 'Major or minor arcana - any card.', emoji: '🃏' },
  { question: 'What moon phase were you born under?', prompt: 'And how does it show up in your life?', emoji: '🌕' },
  { question: 'What herb or plant are you working with lately?', prompt: 'In spells, in tea, in the garden - anywhere.', emoji: '🌿' },
  { question: 'What intention are you setting for this lunar cycle?', prompt: 'Keep it simple and true.', emoji: '🌙' },
  { question: 'What does your morning practice look like?', prompt: 'Or what would you like it to look like?', emoji: '☀️' },
  { question: 'Which deity or archetype resonates with you most?', prompt: 'From any tradition - or none at all.', emoji: '🔮' },
  { question: 'What is one thing you wish you had known when you started?', prompt: 'Pass it forward.', emoji: '📖' },
  { question: 'How do you ground yourself after heavy energy work?', prompt: 'Share your go-to method.', emoji: '🌍' },
  { question: 'What does your dream grimoire look like?', prompt: 'Describe it in detail.', emoji: '📓' },
  { question: 'Which sabbat is your favourite and why?', prompt: 'Samhain, Beltane, Yule - or another?', emoji: '🍂' },
  { question: 'What is the most meaningful spell you have ever cast?', prompt: 'Share the feeling, not the details.', emoji: '⭐' },
  { question: 'How do you honour the seasons where you live?', prompt: 'Especially in climates that differ from the traditional wheel.', emoji: '🍃' },
  { question: 'What is your relationship with divination?', prompt: 'Tarot, runes, pendulum, scrying - or something else?', emoji: '🔮' },
  { question: 'What does protection mean in your practice?', prompt: 'Wards, shields, banishments - how do you work with it?', emoji: '🛡️' },
  { question: 'What is one mundane act you have made magical?', prompt: 'Cooking, cleaning, commuting - magic is everywhere.', emoji: '✨' },
  { question: 'How do you work with the moon?', prompt: 'New moon intentions, full moon releases, or something else?', emoji: '🌙' },
  { question: 'What is your relationship with your ancestors?', prompt: 'Ancestral work, altars, or just curiosity.', emoji: '🕯' },
  { question: 'Which magical tradition or path resonates most with you?', prompt: 'Wicca, hedge witchcraft, chaos magic, green witch - or your own blend?', emoji: '🌿' },
  { question: 'What is something you are currently learning in your practice?', prompt: 'A new skill, a new system, a new perspective.', emoji: '📚' },
  { question: 'How do you celebrate your wins - magical and mundane?', prompt: 'Gratitude is its own magic.', emoji: '🥂' },
  { question: 'What does your sacred space feel like?', prompt: 'Describe the energy, not just the objects.', emoji: '🏡' },
  { question: 'What is one misconception about witchcraft you wish people understood?', prompt: 'Educate with kindness.', emoji: '💬' },
  { question: 'How do you work with your dreams?', prompt: 'Dream journaling, lucid dreaming, or just noticing?', emoji: '💤' },
  { question: 'What is your relationship with the sun?', prompt: 'Solar magic, sun salutations, or just soaking it in?', emoji: '☀️' },
  { question: 'What is the most unexpected thing that has happened in your practice?', prompt: 'Synchronicities, signs, surprises.', emoji: '⚡' },
  { question: 'How do you handle magical burnout?', prompt: 'Rest is part of the practice.', emoji: '🌸' },
  { question: 'What is your favourite way to raise energy?', prompt: 'Dance, chant, breathwork, drumming - share your method.', emoji: '🔥' },
  { question: 'What does your practice look like on a low-energy day?', prompt: 'Magic works even in imperfect conditions.', emoji: '🌧️' },
  { question: 'Which animal or creature feels like a guide to you?', prompt: 'Familiar, totem, or just a recurring presence.', emoji: '🦉' },
  { question: 'What is one book that changed your practice?', prompt: 'Or a resource - podcast, teacher, community.', emoji: '📖' },
  { question: 'How do you balance the magical and the mundane?', prompt: 'Or do you see them as the same thing?', emoji: '⚖️' },
  { question: 'What is your relationship with water in your practice?', prompt: 'Moon water, sea magic, rain rituals - or just a bath.', emoji: '💧' },
  { question: 'What does your practice look like during difficult times?', prompt: 'Grief, illness, transition - how does magic show up?', emoji: '🌑' },
  { question: 'What is something you are grateful for in your practice right now?', prompt: 'Gratitude amplifies everything.', emoji: '💛' },
  { question: 'How do you work with colour in your magic?', prompt: 'Candles, clothing, altar cloths - colour carries energy.', emoji: '🎨' },
  { question: 'What is your relationship with the night?', prompt: 'Night owl, moon bather, or something else?', emoji: '🌃' },
  { question: 'What is one thing you do every day that feels like a ritual?', prompt: 'Even if you never called it that before.', emoji: '☕' },
  { question: 'How do you work with intention?', prompt: 'Setting it, holding it, releasing it.', emoji: '🎯' },
  { question: 'What is your relationship with silence in your practice?', prompt: 'Meditation, stillness, listening.', emoji: '🤐' },
  { question: 'What is one spell or working you want to try?', prompt: 'Dream big or start small - both are valid.', emoji: '⭐' },
  { question: 'How do you mark the end of a ritual?', prompt: 'Closing the circle, grounding, giving thanks.', emoji: '🕯' },
  { question: 'What is your relationship with the stars?', prompt: 'Astrology, stargazing, or just feeling small in the best way.', emoji: '⭐' },
  { question: 'What is one thing you would tell your past self about the craft?', prompt: 'Wisdom earned through experience.', emoji: '💌' },
  { question: 'How do you work with the energy of a new season?', prompt: 'What shifts in your practice as the wheel turns?', emoji: '🍂' },
  { question: 'What is your favourite way to cleanse your space?', prompt: 'Smoke, sound, salt, intention - or something else?', emoji: '🌬️' },
  { question: 'What does community mean to you in your practice?', prompt: 'Solitary, coven, online - how do you connect?', emoji: '🤝' },
  { question: 'What is one magical goal you are working toward?', prompt: 'Big or small - all goals are worthy.', emoji: '🎯' },
  { question: 'How do you work with the energy of the current season?', prompt: 'What does this time of year ask of you?', emoji: '🌿' },
  { question: 'What is your relationship with your intuition?', prompt: 'Do you trust it? How do you develop it?', emoji: '🔮' },
  { question: 'What is one thing that surprised you about your own practice?', prompt: 'Something unexpected - a joy or a struggle.', emoji: '💫' },
  { question: 'How do you work with the energy of the full moon?', prompt: 'Release, celebrate, charge, or something else?', emoji: '🌕' },
  { question: 'What is your relationship with fire in your practice?', prompt: 'Candles, bonfires, hearth magic - fire is transformation.', emoji: '🔥' },
  { question: 'What is one thing you are releasing this cycle?', prompt: 'Let it go with intention.', emoji: '🍃' },
  { question: 'How do you honour your practice on busy days?', prompt: 'Even one breath with intention counts.', emoji: '⏰' },
  { question: 'What is your relationship with the earth in your practice?', prompt: 'Grounding, gardening, forest bathing - earth holds us.', emoji: '🌍' },
  { question: 'What is one word that describes your practice right now?', prompt: 'Just one - trust the first one that comes.', emoji: '✨' },
];

// -- Moon phase calculator (no external deps) ---------------------------------
function getMoonPhase(date: Date): { phase: string; emoji: string; daysUntil: number } {
  const knownNewMoon = new Date('2000-01-06T18:14:00Z').getTime();
  const synodicMonth = 29.530588853 * 24 * 60 * 60 * 1000;
  const now = date.getTime();
  const elapsed = (now - knownNewMoon) % synodicMonth;
  const age = elapsed / synodicMonth;

  const daysToNewMoon = (1 - age) * 29.530588853;
  const daysToFullMoon = (age < 0.5 ? 0.5 - age : 1.5 - age) * 29.530588853;

  if (daysToNewMoon <= daysToFullMoon) {
    return { phase: 'New Moon', emoji: '🌑', daysUntil: Math.round(daysToNewMoon) };
  }
  return { phase: 'Full Moon', emoji: '🌕', daysUntil: Math.round(daysToFullMoon) };
}

// -- Handler ------------------------------------------------------------------
export default async function handler(_req: Request, res: Response) {
  if (!db) return res.status(503).json({ error: 'Database unavailable' });

  try { await runStartupMigration(); } catch { /* may already be complete */ }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  // 1. QOTD - fetch or auto-seed
  let qotd: { question: string; prompt: string | null; emoji: string | null } | null = null;
  try {
    const [existing] = await db
      .select({ question: covenHearthQotd.question, prompt: covenHearthQotd.prompt, emoji: covenHearthQotd.emoji })
      .from(covenHearthQotd)
      .where(eq(covenHearthQotd.date, todayStr))
      .limit(1);

    if (existing) {
      qotd = existing;
    } else {
      const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
      const seed = QOTD_BANK[dayOfYear % QOTD_BANK.length];
      await db.insert(covenHearthQotd).values({
        date: todayStr,
        question: seed.question,
        prompt: seed.prompt ?? null,
        emoji: seed.emoji,
      }).onDuplicateKeyUpdate({ set: { question: seed.question } });
      qotd = { question: seed.question, prompt: seed.prompt ?? null, emoji: seed.emoji };
    }
  } catch { /* table may not exist yet */ }

  // 2. Moon event
  const moonEvent = getMoonPhase(today);

  // 3. Featured post - most-liked visible post in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  let featured: {
    id: number; title: string; likeCount: number; replyCount: number;
    username: string | null; createdAt: Date | null; categoryName: string | null;
  } | null = null;

  try {
    const [fp] = await db
      .select({
        id: communityPosts.id,
        title: communityPosts.title,
        likeCount: communityPosts.likeCount,
        replyCount: communityPosts.replyCount,
        username: user.username,
        createdAt: communityPosts.createdAt,
        categoryName: communityCategories.name,
      })
      .from(communityPosts)
      .leftJoin(user, eq(communityPosts.userId, user.id))
      .leftJoin(communityCategories, eq(communityPosts.categoryId, communityCategories.id))
      .where(and(eq(communityPosts.isHidden, false), gt(communityPosts.createdAt, sevenDaysAgo)))
      .orderBy(desc(communityPosts.likeCount))
      .limit(1);
    featured = fp ?? null;
  } catch { /* posts table may be empty */ }

  // 4. Recent discussions - 4 newest, excluding featured
  type RecentPost = { id: number; title: string; replyCount: number; username: string | null; createdAt: Date | null; categoryName: string | null };
  let recent: RecentPost[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions: any[] = [eq(communityPosts.isHidden, false)];
    if (featured) conditions.push(ne(communityPosts.id, featured.id));
    recent = await db
      .select({
        id: communityPosts.id,
        title: communityPosts.title,
        replyCount: communityPosts.replyCount,
        username: user.username,
        createdAt: communityPosts.createdAt,
        categoryName: communityCategories.name,
      })
      .from(communityPosts)
      .leftJoin(user, eq(communityPosts.userId, user.id))
      .leftJoin(communityCategories, eq(communityPosts.categoryId, communityCategories.id))
      .where(and(...conditions))
      .orderBy(desc(communityPosts.createdAt))
      .limit(4);
  } catch { /* empty */ }

  res.json({ qotd, moonEvent, featured, recent });
}
