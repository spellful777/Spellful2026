import { z } from 'zod';
import { SPREADS, TAROT_CARDS } from './tarot-data';
import { ZODIAC_SIGNS } from './zodiac-data';
import { NUMEROLOGY_MEANINGS } from './numerology-meanings';

const tarotSharedReadingSchema = z.object({
  type: z.literal('tarot'),
  spreadType: z.string().max(40),
  cards: z.array(z.object({
    cardId: z.string().max(50),
    reversed: z.boolean(),
    displayOrder: z.number().int().min(0).max(19),
  }).strict()).min(1).max(20),
  includePositions: z.boolean(),
  includeInterpretations: z.boolean(),
}).strict().refine(
  reading => new Set(reading.cards.map(card => card.displayOrder)).size === reading.cards.length,
  'Select each spread position only once',
);

export const NUMEROLOGY_RESULT_LABELS = {
  lifePath: 'Life Path',
  expression: 'Expression',
  soulUrge: 'Soul Urge',
  personality: 'Personality',
  personalYear: 'Personal Year',
} as const;

const numerologySharedReadingSchema = z.object({
  type: z.literal('numerology'),
  numbers: z.array(z.object({
    kind: z.enum(['lifePath', 'expression', 'soulUrge', 'personality', 'personalYear']),
    value: z.number().int().refine(value => Object.hasOwn(NUMEROLOGY_MEANINGS, value)),
  }).strict()).min(1).max(5),
  includeInterpretations: z.boolean(),
}).strict().refine(
  reading => new Set(reading.numbers.map(number => number.kind)).size === reading.numbers.length,
  'Select each result only once',
);

const ZODIAC_BY_NAME = new Map(ZODIAC_SIGNS.map(sign => [sign.name, sign]));
const ASTROLOGY_LABELS = { sun: 'Sun', moon: 'Moon', rising: 'Rising' } as const;

const astrologySharedReadingSchema = z.object({
  type: z.literal('astrology'),
  placements: z.array(z.object({
    kind: z.enum(['sun', 'moon', 'rising']),
    sign: z.string().max(12).refine(sign => ZODIAC_BY_NAME.has(sign)),
  }).strict()).min(1).max(3),
  includeInterpretations: z.boolean(),
}).strict().refine(
  reading => new Set(reading.placements.map(placement => placement.kind)).size === reading.placements.length,
  'Select each placement only once',
);

export const sharedReadingSchema = z.union([tarotSharedReadingSchema, numerologySharedReadingSchema, astrologySharedReadingSchema]);
export type TarotSharedReading = z.infer<typeof tarotSharedReadingSchema>;
export type NumerologySharedReading = z.infer<typeof numerologySharedReadingSchema>;

export type AstrologySharedReading = z.infer<typeof astrologySharedReadingSchema>;

export type SharedReading = z.infer<typeof sharedReadingSchema>;

export function sharedReadingItems(reading: SharedReading) {
  switch (reading.type) {
    case 'tarot':
      return reading.cards.map(card => ({
        id: String(card.displayOrder), label: card.cardId.replaceAll('-', ' ') + (card.reversed ? ' (reversed)' : ''),
      }));
    case 'numerology':
      return reading.numbers.map(number => ({ id: number.kind, label: `${NUMEROLOGY_RESULT_LABELS[number.kind]} · ${number.value}` }));
    case 'astrology':
      return reading.placements.map(placement => ({ id: placement.kind, label: `${ASTROLOGY_LABELS[placement.kind]} · ${placement.sign}` }));
  }
}

export function selectSharedReadingItems(reading: SharedReading, selected: string[]): SharedReading {
  switch (reading.type) {
    case 'tarot':
      return { ...reading, cards: reading.cards.filter(card => selected.includes(String(card.displayOrder))) };
    case 'numerology':
      return { ...reading, numbers: reading.numbers.filter(number => selected.includes(number.kind)) };
    case 'astrology':
      return { ...reading, placements: reading.placements.filter(placement => selected.includes(placement.kind)) };
  }
}

const cardsBySlug = new Map(TAROT_CARDS.map(card => [
  card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  card,
]));

export function projectTarot(reading: TarotSharedReading) {
  const spread = SPREADS.find(item => item.id === reading.spreadType);
  const cards = reading.cards.map(selected => {
    const card = cardsBySlug.get(selected.cardId);
    return card && {
      name: card.name,
      reversed: selected.reversed,
      position: reading.includePositions ? spread?.positions[selected.displayOrder]?.label : undefined,
      interpretation: reading.includeInterpretations
        ? (selected.reversed ? card.reversedMeaning : card.uprightMeaning)
        : undefined,
    };
  });
  return cards.every(card => card !== undefined) ? cards : null;
}

function escapeText(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function renderSharedReading(reading: SharedReading) {
  if (reading.type === 'astrology') {
    return '<section><h3>Shared birth chart placements</h3>' + reading.placements.map(({ kind, sign }) => {
      const zodiac = ZODIAC_BY_NAME.get(sign);
      const label = `${ASTROLOGY_LABELS[kind]} · ${sign}`;
      const description = reading.includeInterpretations && zodiac
        ? `<details><summary>About ${escapeText(sign)}</summary><p>${escapeText(zodiac.description)}</p></details>`
        : '';
      return `<p><strong>${escapeText(label)}</strong></p>${description}`;
    }).join('') + '</section>';
  }
  if (reading.type === 'numerology') {
    return '<section><h3>Shared numerology reading</h3>' + reading.numbers.map(({ kind, value }) => {
      const label = NUMEROLOGY_RESULT_LABELS[kind];
      const overview = NUMEROLOGY_MEANINGS[value]?.overview;
      const interpretation = reading.includeInterpretations && overview
        ? `<details><summary>Interpretation for ${label} ${value}</summary><p>${escapeText(overview)}</p></details>`
        : '';
      return `<p><strong>${label} · ${value}</strong></p>${interpretation}`;
    }).join('') + '</section>';
  }

  const cards = projectTarot(reading);
  if (!cards) return null;
  return '<section><h3>Shared tarot reading</h3>' + cards.map(card => {
    const label = [card.name + (card.reversed ? ' (reversed)' : ''), card.position].filter(Boolean).join(' · ');
    const interpretation = card.interpretation
      ? `<details><summary>Interpretation for ${escapeText(card.name)}</summary><p>${escapeText(card.interpretation)}</p></details>`
      : '';
    return `<p><strong>${escapeText(label)}</strong></p>${interpretation}`;
  }).join('') + '</section>';
}
