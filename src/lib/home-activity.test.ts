import { describe, expect, it } from 'vitest';
import { generateDailyHoroscope } from './horoscope-engine';
import { horoscopeSnapshot, parseSparkReading } from './spark-reading';
import { mobileDestination } from './mobile-navigation';

describe('Home mobile navigation', () => {
  it.each([
    ['/', '', 'Home'], ['/', '?feed=explore', 'Explore'],
    ['/explore/topics/astrology', '', 'Explore'], ['/spells/candle-ritual', '', 'Explore'],
    ['/community/discover', '', 'Explore'], ['/community/post/17', '', 'Coven'],
    ['/community', '?view=coven&tab=requests', 'Coven'], ['/messages', '', 'Coven'],
    ['/dream-journal', '', 'Grimoire'], ['/grimoire', '?sparks=favorite', 'Grimoire'],
    ['/account/profile', '', 'You'], ['/u/member', '?tab=about', 'You'],
    ['/login', '?redirect=%2Fcommunity%3Fview%3Dcoven', 'Coven'],
  ])('uses the parent destination for %s %s', (path, search, tab) => expect(mobileDestination(path, search)).toBe(tab));
});

describe('shared horoscope', () => {
  it('keeps the four approved fields and survives a change to the daily forecast', () => {
    const yesterday = generateDailyHoroscope('Cancer', '2026-11-25');
    const extra = { ...yesterday, birthDate: '1990-06-25', birthTime: '14:02', birthPlace: 'Private place' };
    const snapshot = horoscopeSnapshot(extra);
    expect(Object.keys(snapshot).sort()).toEqual(['body', 'date', 'headline', 'sign', 'type']);
    expect(parseSparkReading(extra)).toBeNull();
    expect(parseSparkReading({ ...snapshot, planetNote: yesterday.planetNote })).toBeNull();
    const tomorrow = generateDailyHoroscope('Cancer', '2026-11-26');
    expect(parseSparkReading(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
    expect(snapshot).not.toEqual(horoscopeSnapshot(tomorrow));
  });
});
