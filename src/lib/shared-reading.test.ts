import { describe, expect, it } from 'vitest';
import { renderSharedReading, sharedReadingSchema, type TarotSharedReading } from './shared-reading';

const selected: TarotSharedReading = {
  type: 'tarot',
  spreadType: 'three-card',
  cards: [{ cardId: 'the-hermit', displayOrder: 1, reversed: false }],
  includePositions: true,
  includeInterpretations: false,
};

describe('shared tarot projection', () => {
  it('keeps only selected catalog fields and makes interpretations expandable when requested', () => {
    const cards = renderSharedReading(selected);
    expect(cards).toContain('The Hermit · Present');
    expect(cards).not.toContain('<details>');
    expect(renderSharedReading({ ...selected, includeInterpretations: true })).toContain('<summary>Interpretation for The Hermit</summary>');
    expect(renderSharedReading({ ...selected, includePositions: false })).not.toContain('Present');
  });

  it('rejects private fields, repeated positions and unknown cards', () => {
    expect(sharedReadingSchema.safeParse({ ...selected, question: 'private' }).success).toBe(false);
    expect(sharedReadingSchema.safeParse({ ...selected, cards: [{ ...selected.cards[0], position: 'private' }] }).success).toBe(false);
    expect(sharedReadingSchema.safeParse({ ...selected, cards: [selected.cards[0], selected.cards[0]] }).success).toBe(false);
    expect(renderSharedReading({ ...selected, cards: [{ ...selected.cards[0], cardId: 'unknown' }] })).toBeNull();
  });
});

it('shares numerology results and excludes raw inputs', () => {
  const payload = { type: 'numerology', numbers: [{ kind: 'lifePath', value: 7 }], includeInterpretations: false };
  const reading = sharedReadingSchema.parse(payload);
  expect(renderSharedReading(reading)).toContain('Life Path · 7');
  expect(renderSharedReading(reading)).not.toContain('<details>');
  expect(renderSharedReading(sharedReadingSchema.parse({ ...payload, includeInterpretations: true }))).toContain('Interpretation for Life Path 7');
  expect(sharedReadingSchema.safeParse({ ...payload, fullName: 'Private Name' }).success).toBe(false);
  expect(sharedReadingSchema.safeParse({ ...payload, birthdate: '2000-10-01' }).success).toBe(false);
  expect(sharedReadingSchema.safeParse({ ...payload, numbers: [{ kind: 'lifePath', value: 2000 }] }).success).toBe(false);
});

it('projects only selected Big Three signs and rejects detailed chart inputs', () => {
  const payload = { type: 'astrology', placements: [{ kind: 'rising', sign: 'Cancer' }], includeInterpretations: true };
  const reading = sharedReadingSchema.parse(payload);
  expect(renderSharedReading(reading)).toContain('Rising · Cancer');
  expect(renderSharedReading(reading)).toContain('<summary>About Cancer</summary>');
  expect(sharedReadingSchema.safeParse({ ...payload, birthTime: '06:00' }).success).toBe(false);
  expect(sharedReadingSchema.safeParse({ ...payload, placements: [{ kind: 'rising', sign: 'Cancer', degrees: 15 }] }).success).toBe(false);
});
