import { z } from 'zod';
import { SPREADS } from './tarot-data';
import { sharedReadingSchema, projectTarot } from './shared-reading';

const angle = z.number().finite().min(0).lt(360);
const natal = z.object({
  type: z.literal('natal'),
  ascendant: angle,
  houses: z.array(angle).length(12),
  planets: z.array(angle).length(10),
}).strict();

export type SparkReading = z.infer<typeof natal> | z.infer<typeof sharedReadingSchema>;

export function parseSparkReading(value: unknown): SparkReading | null {
  const chart = natal.safeParse(value);
  if (chart.success) return chart.data;
  const tarot = sharedReadingSchema.safeParse(value);
  if (!tarot.success) return null;
  const spread = SPREADS.find(item => item.id === tarot.data.spreadType);
  if (!spread || !tarot.data.includePositions || tarot.data.cards.length !== spread.positions.length ||
    tarot.data.cards.some(card => card.displayOrder >= spread.positions.length)) return null;
  return projectTarot(tarot.data) ? tarot.data : null;
}

export function natalWheelSvg(chart: Extract<SparkReading, { type: 'natal' }>) {
  const point = (angle: number, radius: number) => {
    const radians = (angle - chart.ascendant + 90) * Math.PI / 180;
    return [180 + Math.cos(radians) * radius, 180 + Math.sin(radians) * radius].map(n => n.toFixed(2));
  };
  const line = (value: number, outer: number, inner: number, color: string) => {
    const [x1, y1] = point(value, outer), [x2, y2] = point(value, inner);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}"/>`;
  };
  const text = (value: number, r: number, glyph: string, fill: string) => {
    const [x, y] = point(value, r);
    return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" fill="${fill}">${glyph}</text>`;
  };
  const rings = [151, 122, 98, 48].map(radius => `<circle cx="180" cy="180" r="${radius}" fill="none" stroke="#6e5983"/>`).join('');
  const signs = Array.from('♈♉♊♋♌♍♎♏♐♑♒♓').map((glyph, i) =>
    line(i * 30, 151, 122, '#6e5983') + text(i * 30 + 15, 137, glyph, '#dec6ed')).join('');
  const houses = chart.houses.map(angle => line(angle, 122, 48, '#6e5983')).join('');
  const planets = chart.planets.map((angle, i) => text(angle, 57 + (i % 4) * 13, Array.from('☉☽☿♀♂♃♄♅♆♇')[i], '#f5d184')).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360" viewBox="0 0 360 360" font-size="17" font-family="serif"><rect width="360" height="360" rx="24" fill="#1c1329"/>' +
    rings + signs + houses + planets + '</svg>';
}
