/**
 * Spellful Moments — Email Template Library
 * Complete polished subjects, preheaders, HTML bodies, and plain-text fallbacks
 * for every lifecycle occasion. 2-3 variants per key journey.
 * Deterministic — no generative AI dependency.
 *
 * Every marketing email includes:
 *  - Unsubscribe footer with signed token links
 *  - Optional Plus CTA block (free members who consented to plus_offers)
 */

const BASE_URL = 'https://spellful.com';
const LOGO_URL = 'https://spellful.com/airo-assets/images/logo/email';

// ─── Shared HTML Primitives ───────────────────────────────────────────────────

function emailShell(opts: {
  subject: string;
  preheader: string;
  bodyHtml: string;
  plusCtaHtml: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
}): string {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${opts.subject}</title>
</head>
<body style="margin:0;padding:0;background:#0d0b14;font-family:Georgia,'Times New Roman',serif;">
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    ${opts.preheader}&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:#0d0b14;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#1a1528;border-radius:12px;overflow:hidden;
                    border:1px solid #3d2f6e;">
        <!-- Logo header -->
        <tr>
          <td align="center" style="padding:32px 40px 24px;border-bottom:1px solid #3d2f6e;">
            <a href="${BASE_URL}" style="display:inline-block;">
              <img src="${LOGO_URL}" alt="Spellful" width="150" height="auto"
                   style="display:block;max-width:150px;height:auto;" />
            </a>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:36px 40px 28px;">
            ${opts.bodyHtml}
            ${opts.plusCtaHtml}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td align="center" style="padding:20px 40px 28px;border-top:1px solid #3d2f6e;">
            <p style="margin:0 0 8px 0;font-size:11px;color:#7a6fa0;font-family:Arial,sans-serif;line-height:1.5;">
              &copy; ${year} Spellful &nbsp;&middot;&nbsp;
              <a href="${BASE_URL}" style="color:#7a6fa0;text-decoration:underline;">spellful.com</a>
            </p>
            <p style="margin:0;font-size:11px;color:#7a6fa0;font-family:Arial,sans-serif;line-height:1.5;">
              <a href="${opts.preferencesUrl}" style="color:#c9a84c;text-decoration:underline;">Email preferences</a>
              &nbsp;&middot;&nbsp;
              <a href="${opts.unsubscribeUrl}" style="color:#7a6fa0;text-decoration:underline;">Unsubscribe from marketing</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function goldButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px auto 0;">
    <tr>
      <td style="border-radius:6px;background:#c9a84c;">
        <a href="${url}"
           style="display:inline-block;padding:12px 28px;font-family:Arial,sans-serif;
                  font-size:14px;font-weight:600;color:#1a1528;text-decoration:none;
                  letter-spacing:0.04em;">
          ${label}
        </a>
      </td>
    </tr>
  </table>`;
}

function plusCtaBlock(name: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="margin-top:28px;border-top:1px solid #3d2f6e;">
    <tr>
      <td style="padding-top:24px;">
        <p style="margin:0 0 8px 0;font-size:13px;color:#b8a9d9;font-family:Arial,sans-serif;line-height:1.6;">
          Make your Spellful space truly your own, ${name}. Custom profile themes, exclusive rituals,
          and more await with Spellful Plus.
        </p>
        <a href="${BASE_URL}/plus"
           style="font-size:13px;color:#c9a84c;font-family:Arial,sans-serif;text-decoration:underline;">
          Discover Spellful Plus &rarr;
        </a>
      </td>
    </tr>
  </table>`;
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 20px 0;font-size:24px;font-weight:700;color:#f0eaff;
                     line-height:1.3;text-align:center;font-family:Georgia,'Times New Roman',serif;">
    ${text}
  </h1>`;
}

function p(text: string): string {
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.7;color:#c8bfe8;
                    font-family:Arial,sans-serif;">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #3d2f6e;margin:20px 0;" />`;
}

// ─── Token URL helpers ────────────────────────────────────────────────────────

export function unsubscribeUrl(token: string): string {
  return `${BASE_URL}/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function preferencesUrl(token: string): string {
  return `${BASE_URL}/email-preferences?token=${encodeURIComponent(token)}`;
}

// ─── Template result type ─────────────────────────────────────────────────────

export interface MomentsEmailResult {
  subject: string;
  html: string;
  text: string;
}

// ─── Birthday Templates ───────────────────────────────────────────────────────

export function buildBirthdayEmail(opts: {
  name: string;
  variant: 'a' | 'b' | 'c';
  token: string;
  isPlus: boolean;
  plusCtaConsented: boolean;
}): MomentsEmailResult {
  const { name, variant, token, isPlus, plusCtaConsented } = opts;
  const firstName = name.split(' ')[0] ?? name;
  const unsub = unsubscribeUrl(token);
  const prefs = preferencesUrl(token);
  const showPlusCta = !isPlus && plusCtaConsented;

  const variants = {
    a: {
      subject: `Happy birthday, ${firstName} — the stars celebrate you today`,
      preheader: `Wishing you a magical birthday filled with wonder and light.`,
      bodyHtml: h1(`Happy Birthday, ${firstName}`) +
        p(`The wheel turns, and today the cosmos pauses to celebrate you. On this day, the universe marked your arrival — and we are so glad it did.`) +
        p(`May this year bring you clarity in your craft, depth in your connections, and magic in the everyday moments.`) +
        divider() +
        p(`Take a moment today to reflect on how far you have come. Light a candle, pull a card, or simply breathe in the magic of being alive.`) +
        goldButton('Open Your Grimoire', `${BASE_URL}/grimoire`),
      text: `Happy Birthday, ${firstName}!\n\nThe wheel turns, and today the cosmos pauses to celebrate you. On this day, the universe marked your arrival — and we are so glad it did.\n\nMay this year bring you clarity in your craft, depth in your connections, and magic in the everyday moments.\n\nOpen your Grimoire: ${BASE_URL}/grimoire`,
    },
    b: {
      subject: `${firstName}, your birthday magic awaits`,
      preheader: `A new solar return, a new chapter in your magical journey.`,
      bodyHtml: h1(`Your Solar Return, ${firstName}`) +
        p(`A solar return is one of the most powerful moments in a witch's year — the sun returns to the exact degree it held when you were born. Today is yours.`) +
        p(`This is a time of intention-setting, of honoring the path you have walked, and of opening yourself to the year ahead.`) +
        divider() +
        p(`We created a space for your magic. Come home to Spellful and write the next chapter.`) +
        goldButton('Visit Your Coven', `${BASE_URL}/community`),
      text: `Your Solar Return, ${firstName}!\n\nA solar return is one of the most powerful moments in a witch's year. Today is yours.\n\nThis is a time of intention-setting, of honoring the path you have walked, and of opening yourself to the year ahead.\n\nVisit your Coven: ${BASE_URL}/community`,
    },
    c: {
      subject: `Blessed birthday, ${firstName} — a gift from Spellful`,
      preheader: `The coven sends you love and light on your special day.`,
      bodyHtml: h1(`Blessed Birthday, ${firstName}`) +
        p(`From everyone in the Spellful coven — happy birthday. Today we celebrate you: your journey, your wisdom, and the unique magic you bring to this community.`) +
        p(`As a birthday gift, take a moment to explore your daily horoscope and see what the stars have in store for your new year.`) +
        goldButton('Read Your Birthday Horoscope', `${BASE_URL}/horoscope`),
      text: `Blessed Birthday, ${firstName}!\n\nFrom everyone in the Spellful coven — happy birthday. Today we celebrate you.\n\nRead your birthday horoscope: ${BASE_URL}/horoscope`,
    },
  };

  const v = variants[variant];
  const plusHtml = showPlusCta ? plusCtaBlock(firstName) : '';
  const plusText = showPlusCta ? `\n\n---\nMake your Spellful space truly your own. Discover Spellful Plus: ${BASE_URL}/plus` : '';

  return {
    subject: v.subject,
    html: emailShell({ subject: v.subject, preheader: v.preheader, bodyHtml: v.bodyHtml, plusCtaHtml: plusHtml, unsubscribeUrl: unsub, preferencesUrl: prefs }),
    text: v.text + plusText + `\n\n---\nEmail preferences: ${prefs}\nUnsubscribe: ${unsub}`,
  };
}

// ─── New Moon Templates ───────────────────────────────────────────────────────

export function buildNewMoonEmail(opts: {
  name: string;
  moonName: string; // e.g. "New Moon in Scorpio"
  variant: 'a' | 'b';
  token: string;
  isPlus: boolean;
  plusCtaConsented: boolean;
}): MomentsEmailResult {
  const { name, moonName, variant, token, isPlus, plusCtaConsented } = opts;
  const firstName = name.split(' ')[0] ?? name;
  const unsub = unsubscribeUrl(token);
  const prefs = preferencesUrl(token);
  const showPlusCta = !isPlus && plusCtaConsented;

  const variants = {
    a: {
      subject: `${moonName} — a portal for new beginnings`,
      preheader: `The new moon opens a window for intention and renewal.`,
      bodyHtml: h1(moonName) +
        p(`The new moon rises tonight, ${firstName} — a sacred pause between cycles. In the darkness before the light returns, there is extraordinary power for planting seeds of intention.`) +
        p(`This is the moment to write your wishes, set your intentions, and call in what you want to grow over the coming lunar cycle.`) +
        divider() +
        p(`Light a black or white candle, find a quiet moment, and let the new moon hold your dreams.`) +
        goldButton('Explore Moon Rituals', `${BASE_URL}/moon-rituals`),
      text: `${moonName}\n\nThe new moon rises tonight, ${firstName}. In the darkness before the light returns, there is extraordinary power for planting seeds of intention.\n\nExplore moon rituals: ${BASE_URL}/moon-rituals`,
    },
    b: {
      subject: `New moon tonight — set your intentions, ${firstName}`,
      preheader: `A fresh lunar cycle begins. What will you call in?`,
      bodyHtml: h1(`New Moon Tonight`) +
        p(`${firstName}, the new moon is here — the most potent time in the lunar cycle for manifestation and new beginnings.`) +
        p(`Take a few minutes tonight to journal your intentions. What do you want to invite into your life? What are you ready to begin?`) +
        goldButton('Open Your Grimoire', `${BASE_URL}/grimoire`),
      text: `New Moon Tonight\n\n${firstName}, the new moon is here — the most potent time for manifestation and new beginnings.\n\nOpen your Grimoire: ${BASE_URL}/grimoire`,
    },
  };

  const v = variants[variant];
  const plusHtml = showPlusCta ? plusCtaBlock(firstName) : '';
  const plusText = showPlusCta ? `\n\n---\nDiscover Spellful Plus: ${BASE_URL}/plus` : '';

  return {
    subject: v.subject,
    html: emailShell({ subject: v.subject, preheader: v.preheader, bodyHtml: v.bodyHtml, plusCtaHtml: plusHtml, unsubscribeUrl: unsub, preferencesUrl: prefs }),
    text: v.text + plusText + `\n\n---\nEmail preferences: ${prefs}\nUnsubscribe: ${unsub}`,
  };
}

// ─── Full Moon Templates ──────────────────────────────────────────────────────

export function buildFullMoonEmail(opts: {
  name: string;
  moonName: string;
  variant: 'a' | 'b';
  token: string;
  isPlus: boolean;
  plusCtaConsented: boolean;
}): MomentsEmailResult {
  const { name, moonName, variant, token, isPlus, plusCtaConsented } = opts;
  const firstName = name.split(' ')[0] ?? name;
  const unsub = unsubscribeUrl(token);
  const prefs = preferencesUrl(token);
  const showPlusCta = !isPlus && plusCtaConsented;

  const variants = {
    a: {
      subject: `${moonName} — release, illuminate, celebrate`,
      preheader: `The full moon is here. What are you ready to let go of?`,
      bodyHtml: h1(moonName) +
        p(`The full moon illuminates the sky tonight, ${firstName}. This is the peak of the lunar cycle — a time of culmination, revelation, and release.`) +
        p(`What has been building since the new moon? What are you ready to release? The full moon holds space for both celebration and letting go.`) +
        divider() +
        p(`Try a simple release ritual: write what you wish to release on paper, then safely burn or bury it under the moonlight.`) +
        goldButton('Explore Full Moon Rituals', `${BASE_URL}/moon-rituals`),
      text: `${moonName}\n\nThe full moon illuminates the sky tonight, ${firstName}. This is the peak of the lunar cycle — a time of culmination, revelation, and release.\n\nExplore full moon rituals: ${BASE_URL}/moon-rituals`,
    },
    b: {
      subject: `Full moon energy is here, ${firstName}`,
      preheader: `Charge your crystals, pull a card, and bask in the moonlight.`,
      bodyHtml: h1(`Full Moon Tonight`) +
        p(`${firstName}, the full moon is at its peak. This is the most powerful time for divination, charging your tools, and releasing what no longer serves you.`) +
        p(`Pull a tarot card tonight and ask: what is the full moon illuminating for me right now?`) +
        goldButton('Open Tarot', `${BASE_URL}/resources/tarot`),
      text: `Full Moon Tonight\n\n${firstName}, the full moon is at its peak. Pull a tarot card and ask: what is the full moon illuminating for me right now?\n\nOpen Tarot: ${BASE_URL}/resources/tarot`,
    },
  };

  const v = variants[variant];
  const plusHtml = showPlusCta ? plusCtaBlock(firstName) : '';
  const plusText = showPlusCta ? `\n\n---\nDiscover Spellful Plus: ${BASE_URL}/plus` : '';

  return {
    subject: v.subject,
    html: emailShell({ subject: v.subject, preheader: v.preheader, bodyHtml: v.bodyHtml, plusCtaHtml: plusHtml, unsubscribeUrl: unsub, preferencesUrl: prefs }),
    text: v.text + plusText + `\n\n---\nEmail preferences: ${prefs}\nUnsubscribe: ${unsub}`,
  };
}

// ─── Sabbat / Seasonal Templates ─────────────────────────────────────────────

const SABBAT_COPY: Record<string, { greeting: string; body1: string; body2: string; cta: string; ctaUrl: string }> = {
  Imbolc:     { greeting: 'Blessed Imbolc', body1: 'The first breath of spring stirs beneath the frozen earth. Imbolc marks the midpoint between winter solstice and spring equinox — a time of purification, hope, and the return of light.', body2: 'Light a white candle tonight and set intentions for what you wish to grow in the coming season.', cta: 'Explore Imbolc Rituals', ctaUrl: `${BASE_URL}/community` },
  Ostara:     { greeting: 'Blessed Ostara', body1: 'The spring equinox arrives, bringing perfect balance between light and dark. Ostara is a time of renewal, fertility, and fresh beginnings — the world awakens.', body2: 'Plant seeds — literal or metaphorical — for what you wish to cultivate this spring.', cta: 'Explore Spring Rituals', ctaUrl: `${BASE_URL}/community` },
  Beltane:    { greeting: 'Blessed Beltane', body1: 'The fires of Beltane burn bright. This is the height of spring — a celebration of life, abundance, and the sacred union of earth and sky.', body2: 'Dance around a fire, weave flowers into your hair, and celebrate the wild, joyful magic of being alive.', cta: 'Join the Coven', ctaUrl: `${BASE_URL}/community` },
  Litha:      { greeting: 'Blessed Litha', body1: 'The summer solstice arrives — the longest day of the year. The sun is at its peak, and the world is bathed in golden light.', body2: 'Gather herbs at dawn, charge your crystals in the sunlight, and celebrate the fullness of the season.', cta: 'Explore Litha Rituals', ctaUrl: `${BASE_URL}/community` },
  Lughnasadh: { greeting: 'Blessed Lughnasadh', body1: 'The first harvest is here. Lughnasadh calls us to give thanks for the abundance in our lives and to begin the turn toward autumn.', body2: 'Bake bread, share a meal, and reflect on what you have harvested — in your garden, your craft, and your life.', cta: 'Explore Harvest Rituals', ctaUrl: `${BASE_URL}/community` },
  Mabon:      { greeting: 'Blessed Mabon', body1: 'The autumn equinox brings balance once more. Mabon is the second harvest — a time of gratitude, reflection, and preparation for the dark half of the year.', body2: 'Take stock of what you have gathered this year. What are you grateful for? What are you ready to release?', cta: 'Explore Mabon Rituals', ctaUrl: `${BASE_URL}/community` },
  Samhain:    { greeting: 'Blessed Samhain', body1: 'The veil between worlds grows thin. Samhain — the witch\'s new year — is the most sacred night on the Wheel of the Year.', body2: 'Honor your ancestors, release what no longer serves you, and step into the new year with intention and power.', cta: 'Explore Samhain Rituals', ctaUrl: `${BASE_URL}/community` },
  Yule:       { greeting: 'Blessed Yule', body1: 'The winter solstice arrives — the longest night of the year. In the darkness, we celebrate the rebirth of the sun and the return of light.', body2: 'Light candles, gather with loved ones, and honor the quiet magic of the darkest night.', cta: 'Explore Yule Rituals', ctaUrl: `${BASE_URL}/community` },
};

export function buildSabbatEmail(opts: {
  name: string;
  sabbatName: string;
  sabbatDescription: string;
  variant: 'a' | 'b';
  token: string;
  isPlus: boolean;
  plusCtaConsented: boolean;
}): MomentsEmailResult {
  const { name, sabbatName, variant, token, isPlus, plusCtaConsented } = opts;
  const firstName = name.split(' ')[0] ?? name;
  const unsub = unsubscribeUrl(token);
  const prefs = preferencesUrl(token);
  const showPlusCta = !isPlus && plusCtaConsented;
  const copy = SABBAT_COPY[sabbatName] ?? {
    greeting: `Blessed ${sabbatName}`,
    body1: opts.sabbatDescription,
    body2: 'May this sacred day bring you magic, connection, and wonder.',
    cta: 'Join the Coven',
    ctaUrl: `${BASE_URL}/community`,
  };

  const variants = {
    a: {
      subject: `${copy.greeting}, ${firstName} — the Wheel turns`,
      preheader: opts.sabbatDescription,
      bodyHtml: h1(copy.greeting) +
        p(`${firstName}, ${copy.body1}`) +
        divider() +
        p(copy.body2) +
        goldButton(copy.cta, copy.ctaUrl),
      text: `${copy.greeting}, ${firstName}\n\n${copy.body1}\n\n${copy.body2}\n\n${copy.cta}: ${copy.ctaUrl}`,
    },
    b: {
      subject: `The Wheel turns — ${sabbatName} is here`,
      preheader: `A sacred moment on the Wheel of the Year.`,
      bodyHtml: h1(`${sabbatName} Blessings`) +
        p(`${firstName}, today the Wheel of the Year turns to ${sabbatName}. ${copy.body1}`) +
        p(copy.body2) +
        goldButton('Explore the Wheel of the Year', `${BASE_URL}/resources`),
      text: `${sabbatName} Blessings\n\n${firstName}, today the Wheel of the Year turns to ${sabbatName}. ${copy.body1}\n\n${copy.body2}\n\nExplore the Wheel of the Year: ${BASE_URL}/resources`,
    },
  };

  const v = variants[variant];
  const plusHtml = showPlusCta ? plusCtaBlock(firstName) : '';
  const plusText = showPlusCta ? `\n\n---\nDiscover Spellful Plus: ${BASE_URL}/plus` : '';

  return {
    subject: v.subject,
    html: emailShell({ subject: v.subject, preheader: v.preheader, bodyHtml: v.bodyHtml, plusCtaHtml: plusHtml, unsubscribeUrl: unsub, preferencesUrl: prefs }),
    text: v.text + plusText + `\n\n---\nEmail preferences: ${prefs}\nUnsubscribe: ${unsub}`,
  };
}

// ─── Anniversary Templates ────────────────────────────────────────────────────

export function buildAnniversaryEmail(opts: {
  name: string;
  years: number;
  variant: 'a' | 'b';
  token: string;
  isPlus: boolean;
  plusCtaConsented: boolean;
}): MomentsEmailResult {
  const { name, years, variant, token, isPlus, plusCtaConsented } = opts;
  const firstName = name.split(' ')[0] ?? name;
  const unsub = unsubscribeUrl(token);
  const prefs = preferencesUrl(token);
  const showPlusCta = !isPlus && plusCtaConsented;
  const yearLabel = years === 1 ? 'one year' : `${years} years`;

  const variants = {
    a: {
      subject: `Another year of magic together \u2728`,
      preheader: `Thank you for being part of our coven, ${firstName}.`,
      bodyHtml: h1(`We are glad you are here, ${firstName}`) +
        p(`It has been ${yearLabel} since you joined Spellful. Thank you for being part of this community and for bringing your own magic to the coven.`) +
        p(`Your journey here is your own — the Grimoire entries, the moon rituals, the daily check-ins. We hope Spellful has been a meaningful part of your year.`) +
        goldButton('Visit Your Profile', `${BASE_URL}/profile`),
      text: `We are glad you are here, ${firstName}\n\nIt has been ${yearLabel} since you joined Spellful. Thank you for being part of this community.\n\nVisit your profile: ${BASE_URL}/profile`,
    },
    b: {
      subject: `${yearLabel} of magic — thank you, ${firstName} \u2728`,
      preheader: `A small note of gratitude from the Spellful Team.`,
      bodyHtml: h1(`${yearLabel.charAt(0).toUpperCase() + yearLabel.slice(1)} of Spellful`) +
        p(`${firstName}, we wanted to take a moment to say thank you. ${yearLabel.charAt(0).toUpperCase() + yearLabel.slice(1)} ago you joined our coven, and we are so glad you did.`) +
        p(`The community is richer for having you in it. May the year ahead bring you wonder, connection, and moments of magic that feel entirely your own.`) +
        goldButton('See Your Journey', `${BASE_URL}/dashboard`),
      text: `${yearLabel.charAt(0).toUpperCase() + yearLabel.slice(1)} of Spellful\n\n${firstName}, thank you for being part of our coven for ${yearLabel}. The community is richer for having you in it.\n\nSee your journey: ${BASE_URL}/dashboard`,
    },
  };

  const v = variants[variant];
  const plusHtml = showPlusCta ? plusCtaBlock(firstName) : '';
  const plusText = showPlusCta ? `\n\n---\nDiscover Spellful Plus: ${BASE_URL}/plus` : '';

  return {
    subject: v.subject,
    html: emailShell({ subject: v.subject, preheader: v.preheader, bodyHtml: v.bodyHtml, plusCtaHtml: plusHtml, unsubscribeUrl: unsub, preferencesUrl: prefs }),
    text: v.text + plusText + `\n\n---\nEmail preferences: ${prefs}\nUnsubscribe: ${unsub}`,
  };
}

// ─── Feature Discovery Templates ─────────────────────────────────────────────

export function buildDiscoveryEmail(opts: {
  name: string;
  variant: 'a' | 'b';
  token: string;
  isPlus: boolean;
  plusCtaConsented: boolean;
}): MomentsEmailResult {
  const { name, variant, token, isPlus, plusCtaConsented } = opts;
  const firstName = name.split(' ')[0] ?? name;
  const unsub = unsubscribeUrl(token);
  const prefs = preferencesUrl(token);
  const showPlusCta = !isPlus && plusCtaConsented;

  const variants = {
    a: {
      subject: `Have you tried this yet, ${firstName}?`,
      preheader: `A feature of Spellful you might love.`,
      bodyHtml: h1(`Your Grimoire is waiting`) +
        p(`${firstName}, did you know your Grimoire can hold spells, tarot readings, herbal notes, dream entries, and moon rituals — all in one private space?`) +
        p(`Many members find it becomes one of their most-used parts of Spellful. It is completely private, searchable, and yours.`) +
        goldButton('Open Your Grimoire', `${BASE_URL}/grimoire`),
      text: `Your Grimoire is waiting, ${firstName}\n\nYour Grimoire can hold spells, tarot readings, herbal notes, dream entries, and moon rituals — all in one private space.\n\nOpen your Grimoire: ${BASE_URL}/grimoire`,
    },
    b: {
      subject: `A little something you might have missed, ${firstName}`,
      preheader: `The moon calendar is one of our most-loved features.`,
      bodyHtml: h1(`The Moon Calendar`) +
        p(`${firstName}, each month Spellful tracks new moons, full moons, and the turning of the Wheel of the Year — all in one place.`) +
        p(`You can use the moon calendar to plan rituals, set intentions, and stay connected to the seasonal rhythms that matter to you.`) +
        goldButton('Explore the Moon Calendar', `${BASE_URL}/moon`),
      text: `The Moon Calendar, ${firstName}\n\nEach month Spellful tracks new moons, full moons, and the turning of the Wheel of the Year.\n\nExplore the moon calendar: ${BASE_URL}/moon`,
    },
  };

  const v = variants[variant];
  const plusHtml = showPlusCta ? plusCtaBlock(firstName) : '';
  const plusText = showPlusCta ? `\n\n---\nDiscover Spellful Plus: ${BASE_URL}/plus` : '';

  return {
    subject: v.subject,
    html: emailShell({ subject: v.subject, preheader: v.preheader, bodyHtml: v.bodyHtml, plusCtaHtml: plusHtml, unsubscribeUrl: unsub, preferencesUrl: prefs }),
    text: v.text + plusText + `\n\n---\nEmail preferences: ${prefs}\nUnsubscribe: ${unsub}`,
  };
}

// ─── Re-engagement Templates ──────────────────────────────────────────────────

export function buildReEngagementEmail(opts: {
  name: string;
  variant: 'a' | 'b';
  token: string;
  isPlus: boolean;
  plusCtaConsented: boolean;
}): MomentsEmailResult {
  const { name, variant, token, isPlus, plusCtaConsented } = opts;
  const firstName = name.split(' ')[0] ?? name;
  const unsub = unsubscribeUrl(token);
  const prefs = preferencesUrl(token);
  const showPlusCta = !isPlus && plusCtaConsented;

  const variants = {
    a: {
      subject: `${firstName}, your coven misses you`,
      preheader: `The magic is still here whenever you are ready to return.`,
      bodyHtml: h1(`We have been thinking of you`) +
        p(`${firstName}, it has been a while since we have seen you in the coven. Life gets busy — we understand. But your magic does not disappear when you step away.`) +
        p(`Come back whenever you are ready. Your Grimoire is waiting, the community is here, and the moon keeps turning.`) +
        goldButton('Return to Spellful', `${BASE_URL}/dashboard`),
      text: `We have been thinking of you, ${firstName}\n\nIt has been a while since we have seen you in the coven. Your Grimoire is waiting, the community is here, and the moon keeps turning.\n\nReturn to Spellful: ${BASE_URL}/dashboard`,
    },
    b: {
      subject: `A lot has happened since you were last here, ${firstName}`,
      preheader: `New rituals, new community posts, and the moon has cycled several times.`,
      bodyHtml: h1(`Welcome Back, ${firstName}`) +
        p(`The coven has been busy. New moon rituals, community discussions, and daily check-ins have been flowing through Spellful since you were last here.`) +
        p(`Your space is exactly as you left it. Come back and see what you have missed.`) +
        goldButton('See What is New', `${BASE_URL}/community`),
      text: `Welcome Back, ${firstName}\n\nThe coven has been busy. New moon rituals, community discussions, and daily check-ins have been flowing through Spellful since you were last here.\n\nSee what is new: ${BASE_URL}/community`,
    },
  };

  const v = variants[variant];
  const plusHtml = showPlusCta ? plusCtaBlock(firstName) : '';
  const plusText = showPlusCta ? `\n\n---\nDiscover Spellful Plus: ${BASE_URL}/plus` : '';

  return {
    subject: v.subject,
    html: emailShell({ subject: v.subject, preheader: v.preheader, bodyHtml: v.bodyHtml, plusCtaHtml: plusHtml, unsubscribeUrl: unsub, preferencesUrl: prefs }),
    text: v.text + plusText + `\n\n---\nEmail preferences: ${prefs}\nUnsubscribe: ${unsub}`,
  };
}
