/**
 * Spellful Moments — Calendar Engine
 * Pure-JS lunar phase calculator, seasonal/sabbat dates, and birthday matcher.
 * No external dependencies. All calculations are deterministic and timezone-aware.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type MoonPhaseEvent = {
  type: 'new_moon' | 'full_moon';
  date: string; // YYYY-MM-DD UTC
  name: string; // e.g. "New Moon in Scorpio"
};

export type SabbatEvent = {
  type: 'sabbat';
  name: string;   // e.g. "Yule"
  date: string;   // YYYY-MM-DD
  description: string;
};

export type SeasonalEvent = MoonPhaseEvent | SabbatEvent;

// ─── Lunar Phase Calculator ───────────────────────────────────────────────────
// Based on Jean Meeus "Astronomical Algorithms" simplified formula.
// Accurate to within ~1 hour for dates 1900–2100.

/** Julian Day Number from a calendar date */
function julianDay(year: number, month: number, day: number): number {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

/** Calendar date from Julian Day Number */
function fromJulianDay(jd: number): Date {
  const z = Math.floor(jd + 0.5);
  const f = jd + 0.5 - z;
  let a = z;
  if (z >= 2299161) {
    const alpha = Math.floor((z - 1867216.25) / 36524.25);
    a = z + 1 + alpha - Math.floor(alpha / 4);
  }
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  const hours = f * 24;
  return new Date(Date.UTC(year, month - 1, day, Math.floor(hours), Math.round((hours % 1) * 60)));
}

/**
 * Returns the Julian Day of the k-th new moon after J2000.0 (Jan 1.5, 2000).
 * k=0 is the new moon nearest to Jan 6, 2000.
 */
function newMoonJD(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;
  let JDE = 2451550.09766 + 29.530588861 * k
    + 0.00015437 * T2 - 0.000000150 * T3 + 0.00000000073 * T4;
  // Sun anomaly
  const M = (2.5534 + 29.10535670 * k - 0.0000014 * T2 - 0.00000011 * T3) * Math.PI / 180;
  // Moon anomaly
  const Mprime = (201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4) * Math.PI / 180;
  // Moon argument of latitude
  const F = (160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4) * Math.PI / 180;
  // Longitude of ascending node
  const Omega = (124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3) * Math.PI / 180;
  JDE += -0.40720 * Math.sin(Mprime)
    + 0.17241 * Math.sin(M)
    + 0.01608 * Math.sin(2 * Mprime)
    + 0.01039 * Math.sin(2 * F)
    + 0.00739 * Math.sin(Mprime - M)
    - 0.00514 * Math.sin(Mprime + M)
    + 0.00208 * Math.sin(2 * M)
    - 0.00111 * Math.sin(Mprime - 2 * F)
    - 0.00057 * Math.sin(Mprime + 2 * F)
    + 0.00056 * Math.sin(2 * Mprime + M)
    - 0.00042 * Math.sin(3 * Mprime)
    + 0.00042 * Math.sin(M + 2 * F)
    + 0.00038 * Math.sin(M - 2 * F)
    - 0.00024 * Math.sin(2 * Mprime - M)
    - 0.00017 * Math.sin(Omega)
    - 0.00007 * Math.sin(Mprime + 2 * M);
  return JDE;
}

/** Full moon is half a synodic month after new moon */
function fullMoonJD(k: number): number {
  return newMoonJD(k + 0.5);
}

/** Approximate k for the first new moon of a given year */
function kForYear(year: number): number {
  return Math.floor((year - 2000) * 12.3685);
}

/** ISO date string YYYY-MM-DD from a Date */
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const ZODIAC_SIGNS = [
  'Capricorn','Aquarius','Pisces','Aries','Taurus','Gemini',
  'Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius',
];

function zodiacForDate(d: Date): string {
  const m = d.getUTCMonth(); // 0-based
  return ZODIAC_SIGNS[m] ?? ZODIAC_SIGNS[0];
}

/**
 * Returns all new moon and full moon dates for a given year (UTC dates).
 */
export function getMoonEventsForYear(year: number): MoonPhaseEvent[] {
  const events: MoonPhaseEvent[] = [];
  const k0 = kForYear(year);
  // Scan ~14 lunations before and after to catch edge cases
  for (let k = k0 - 1; k <= k0 + 14; k++) {
    const nmJD = newMoonJD(k);
    const nmDate = fromJulianDay(nmJD);
    if (nmDate.getUTCFullYear() === year) {
      events.push({
        type: 'new_moon',
        date: toIsoDate(nmDate),
        name: `New Moon in ${zodiacForDate(nmDate)}`,
      });
    }
    const fmJD = fullMoonJD(k);
    const fmDate = fromJulianDay(fmJD);
    if (fmDate.getUTCFullYear() === year) {
      events.push({
        type: 'full_moon',
        date: toIsoDate(fmDate),
        name: `Full Moon in ${zodiacForDate(fmDate)}`,
      });
    }
  }
  // Sort by date, deduplicate
  events.sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set<string>();
  return events.filter(e => {
    const key = `${e.type}:${e.date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Wheel of the Year / Sabbats ─────────────────────────────────────────────
// Fixed-date approximations accurate enough for email scheduling.
// Solstices/equinoxes vary by ~1-2 days; we use the standard pagan calendar dates.

const SABBAT_DEFINITIONS: { name: string; month: number; day: number; description: string }[] = [
  { name: 'Imbolc',      month: 2,  day: 1,  description: 'The first stirrings of spring. A time of purification, new beginnings, and the return of light.' },
  { name: 'Ostara',      month: 3,  day: 20, description: 'Spring equinox. Balance of light and dark, renewal, fertility, and fresh starts.' },
  { name: 'Beltane',     month: 5,  day: 1,  description: 'The height of spring. Fire festivals, abundance, and the union of earth and sky.' },
  { name: 'Litha',       month: 6,  day: 21, description: 'Summer solstice. The longest day, peak of solar power, and celebration of light.' },
  { name: 'Lughnasadh',  month: 8,  day: 1,  description: 'First harvest. Gratitude for abundance, the turning of the wheel toward autumn.' },
  { name: 'Mabon',       month: 9,  day: 22, description: 'Autumn equinox. Second harvest, balance, and preparation for the dark half of the year.' },
  { name: 'Samhain',     month: 10, day: 31, description: "The witch's new year. The veil thins; honor ancestors and release what no longer serves." },
  { name: 'Yule',        month: 12, day: 21, description: 'Winter solstice. The longest night, rebirth of the sun, and the return of light.' },
];

export function getSabbatsForYear(year: number): SabbatEvent[] {
  return SABBAT_DEFINITIONS.map(s => ({
    type: 'sabbat' as const,
    name: s.name,
    date: `${year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`,
    description: s.description,
  }));
}

// ─── Birthday Matcher ─────────────────────────────────────────────────────────

/**
 * Returns true if the user's birthday (stored as YYYY-MM-DD or MM-DD) falls
 * on the given date string (YYYY-MM-DD), ignoring year.
 */
export function isBirthdayToday(birthDate: string, todayIso: string): boolean {
  if (!birthDate || !todayIso) return false;
  // Normalize: extract MM-DD from either format
  const bdParts = birthDate.split('-');
  const todayParts = todayIso.split('-');
  if (bdParts.length < 2 || todayParts.length < 3) return false;
  // birthDate may be YYYY-MM-DD (length 3) or MM-DD (length 2)
  const bdMonth = bdParts.length === 3 ? bdParts[1] : bdParts[0];
  const bdDay   = bdParts.length === 3 ? bdParts[2] : bdParts[1];
  return bdMonth === todayParts[1] && bdDay === todayParts[2];
}

/**
 * Returns the dedup key for a birthday send: "birthday:{year}"
 * so each user gets at most one birthday email per calendar year.
 */
export function birthdayDedupKey(year: number): string {
  return `birthday:${year}`;
}

/**
 * Returns the dedup key for a moon event: "new_moon:{date}" or "full_moon:{date}"
 */
export function moonDedupKey(type: 'new_moon' | 'full_moon', date: string): string {
  return `${type}:${date}`;
}

/**
 * Returns the dedup key for a sabbat: "sabbat:{name}:{year}"
 */
export function sabbatDedupKey(name: string, year: number): string {
  return `sabbat:${name.toLowerCase().replace(/\s+/g, '_')}:${year}`;
}

/**
 * Returns the dedup key for membership anniversary: "anniversary:{year}"
 */
export function anniversaryDedupKey(year: number): string {
  return `anniversary:${year}`;
}

/**
 * Returns the dedup key for feature discovery: "discovery:{year}:q{quarter}" (quarterly)
 */
export function discoveryDedupKey(year: number, quarter: number): string {
  return `discovery:${year}:q${quarter}`;
}

/**
 * Returns the dedup key for re-engagement: "re_engagement:{quarter}" (quarterly)
 */
export function reEngagementDedupKey(year: number, quarter: number): string {
  return `re_engagement:${year}:Q${quarter}`;
}

/**
 * Returns all occasions that should be dispatched on a given date.
 * todayIso: YYYY-MM-DD
 */
export function getOccasionsForDate(todayIso: string): {
  moonEvents: MoonPhaseEvent[];
  sabbats: SabbatEvent[];
} {
  const year = parseInt(todayIso.slice(0, 4), 10);
  const moonEvents = getMoonEventsForYear(year).filter(e => e.date === todayIso);
  const sabbats = getSabbatsForYear(year).filter(s => s.date === todayIso);
  return { moonEvents, sabbats };
}

/**
 * Returns today's date as YYYY-MM-DD in UTC.
 */
export function todayUtcIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Returns the current quarter (1-4) for re-engagement scheduling.
 */
export function currentQuarter(): number {
  return Math.ceil((new Date().getUTCMonth() + 1) / 3);
}
