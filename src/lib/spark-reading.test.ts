import { describe, expect, it } from 'vitest';
import { findTopic, topicPath } from './spark-topics';
import { natalWheelSvg, parseSparkReading } from './spark-reading';
import { projectTarot } from './shared-reading';

const chart = { type: 'natal', ascendant: 22, houses: Array.from({ length: 12 }, (_, index) => index * 30),
  planets: Array.from({ length: 10 }, (_, index) => index * 32) } as const;
const tarot = { type: 'tarot', spreadType: 'one-card', includePositions: true, includeInterpretations: false,
  cards: [{ cardId: 'the-fool', reversed: true, displayOrder: 0 }] } as const;

describe('Spark reading projections', () => {
  it('rejects private natal inputs and generates a wheel without metadata or raw inputs', () => {
    expect(parseSparkReading({ ...chart, birthDate: '1990-10-10', birthplace: 'Test place' })).toBeNull();
    expect(parseSparkReading({ ...chart, planets: [9000] })).toBeNull();
    const approved = parseSparkReading(chart);
    expect(approved?.type).toBe('natal');
    if (approved?.type !== 'natal') throw Error('Missing natal projection');
    const svg = natalWheelSvg(approved);
    expect(svg).toMatch(/^<svg /);
    expect(svg).toContain('♈');
    expect(svg).not.toMatch(/metadata|latitude|longitude|birth|date|location|<script/i);
  });

  it('uses the canonical spread, reversal and optional standard meaning, never private text', () => {
    expect(parseSparkReading({ ...tarot, notes: 'Confidential' })).toBeNull();
    expect(parseSparkReading({ ...tarot, question: 'Private question' })).toBeNull();
    expect(parseSparkReading({ ...tarot, spreadType: 'unknown' })).toBeNull();
    const spread = parseSparkReading(tarot);
    expect(spread?.type).toBe('tarot');
    if (spread?.type !== 'tarot') throw Error('Missing tarot projection');
    expect(projectTarot(spread)?.[0]).toMatchObject({ name: 'The Fool', reversed: true, interpretation: undefined });
    expect(projectTarot({ ...spread, includeInterpretations: true })?.[0].interpretation).toBeTruthy();
  });

  it('uses the same topic URLs for existing profile interests and Spark labels', () => {
    expect(findTopic('moon-magic')).toBe('Moon Magic');
    expect(findTopic('  astrology ')).toBe('Astrology');
    expect(topicPath('Shadow Work')).toBe('/explore/topics/shadow-work');
    expect(findTopic('Unknown')).toBeUndefined();
  });
});
