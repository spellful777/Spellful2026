import { Body, Ecliptic, GeoVector, MoonPhase, NextMoonQuarter, SearchGlobalSolarEclipse, SearchLunarEclipse, SearchMoonQuarter } from 'astronomy-engine';

const bodies = [Body.Sun, Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune, Body.Pluto];
const phases = ['New moon', 'First quarter', 'Full moon', 'Last quarter'];
const signs = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];

export function calculatePulse(at: Date) {
  const positions = bodies.map(body => {
    const longitude = Ecliptic(GeoVector(body, at, true)).elon;
    return { body, longitude, sign: signs[Math.floor(longitude / 30)] };
  });
  let quarter = SearchMoonQuarter(at);
  const events = [];
  for (let i = 0; i < 4; i++) {
    events.push({ name: phases[quarter.quarter], time: quarter.time.date.toISOString() });
    quarter = NextMoonQuarter(quarter);
  }
  const solar = SearchGlobalSolarEclipse(at);
  const lunar = SearchLunarEclipse(at);
  events.push({ name: solar.kind + ' solar eclipse (global maximum)', time: solar.peak.date.toISOString() });
  events.push({ name: lunar.kind + ' lunar eclipse (maximum)', time: lunar.peak.date.toISOString() });
  events.sort((a, b) => a.time.localeCompare(b.time));
  return { calculatedAt: at.toISOString(), phaseAngle: MoonPhase(at), positions, events };
}
export type CosmicPulseData = ReturnType<typeof calculatePulse>;
