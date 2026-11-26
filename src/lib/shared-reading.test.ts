import { describe, expect, it } from 'vitest';
import { renderSharedReading, sharedReadingSchema, type SharedReading } from './shared-reading';

const selected: SharedReading = {
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
