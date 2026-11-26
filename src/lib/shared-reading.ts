import { z } from 'zod';
import { SPREADS, TAROT_CARDS } from './tarot-data';

export const sharedReadingSchema = z.object({
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

export type SharedReading = z.infer<typeof sharedReadingSchema>;

const cardsBySlug = new Map(TAROT_CARDS.map(card => [
  card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  card,
]));

export function projectTarot(reading: SharedReading) {
  const spread = SPREADS.find(item => item.id === reading.spreadType);
  const cards = [...reading.cards].sort((a, b) => a.displayOrder - b.displayOrder).map(selected => {
    const card = cardsBySlug.get(selected.cardId);
    return card && {
      name: card.name,
      image: card.image,
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
