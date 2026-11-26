/**
 * RichMessageCard
 * Renders a Spellful rich-content card inside a DM thread.
 * Parses the systemMessage JSON payload and displays a styled card.
 * Handles removed/unavailable content gracefully with a fallback state.
 */
import type { RichCard, RichCardType } from './SpellfulSharePicker';

interface Props {
  systemMessage: string;
  isMine: boolean;
}

const TYPE_LABELS: Record<RichCardType, string> = {
  blessing: 'Blessing',
  spell: 'Spell',
  ritual: 'Moon Ritual',
  tarot_reading: 'Tarot Reading',
};

const TYPE_GRADIENT: Record<RichCardType, string> = {
  blessing: 'linear-gradient(135deg, hsl(var(--primary) / 0.18) 0%, hsl(var(--accent) / 0.12) 100%)',
  spell: 'linear-gradient(135deg, hsl(var(--secondary) / 0.15) 0%, hsl(var(--primary) / 0.10) 100%)',
  ritual: 'linear-gradient(135deg, hsl(var(--accent) / 0.18) 0%, hsl(var(--primary) / 0.08) 100%)',
  tarot_reading: 'linear-gradient(135deg, hsl(var(--accent) / 0.20) 0%, hsl(var(--secondary) / 0.10) 100%)',
};

const TYPE_BORDER: Record<RichCardType, string> = {
  blessing: 'hsl(var(--primary) / 0.35)',
  spell: 'hsl(var(--secondary) / 0.35)',
  ritual: 'hsl(var(--accent) / 0.35)',
  tarot_reading: 'hsl(var(--accent) / 0.40)',
};

export function isRichCard(systemMessage: string | null | undefined): boolean {
  if (!systemMessage) return false;
  try {
    const parsed = JSON.parse(systemMessage) as { type?: string };
    return ['blessing', 'spell', 'ritual', 'tarot_reading'].includes(parsed.type ?? '');
  } catch {
    return false;
  }
}

export default function RichMessageCard({ systemMessage, isMine }: Props) {
  let card: RichCard | null = null;
  try {
    card = JSON.parse(systemMessage) as RichCard;
  } catch {
    // Malformed — show fallback
  }

  if (!card || !['blessing', 'spell', 'ritual', 'tarot_reading'].includes(card.type)) {
    return (
      <div className="px-3 py-2 rounded-2xl text-xs italic"
        style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
        ✨ Shared content is no longer available
      </div>
    );
  }

  const gradient = TYPE_GRADIENT[card.type];
  const borderColor = TYPE_BORDER[card.type];
  const label = TYPE_LABELS[card.type];

  return (
    <div className="rounded-2xl overflow-hidden max-w-[260px]"
      style={{ background: gradient, border: `1px solid ${borderColor}` }}>
      {/* Type badge */}
      <div className="flex items-center gap-1.5 px-3 pt-2.5 pb-1">
        <span className="text-base leading-none">{card.emoji ?? '✨'}</span>
        <span className="text-xs font-semibold tracking-wide uppercase"
          style={{ color: 'hsl(var(--primary))' }}>{label}</span>
      </div>

      {/* Title */}
      <div className="px-3 pb-1">
        <p className="font-serif text-sm font-medium leading-snug"
          style={{ color: 'hsl(var(--foreground))' }}>{card.title}</p>
        {card.subtitle && (
          <p className="text-xs mt-0.5 leading-snug"
            style={{ color: 'hsl(var(--muted-foreground))' }}>{card.subtitle}</p>
        )}
      </div>

      {/* Meta pill */}
      {card.meta && (
        <div className="px-3 pb-1.5">
          <span className="inline-block text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
            {card.meta}
          </span>
        </div>
      )}

      {/* Personal note */}
      {card.note && (
        <div className="mx-3 mb-2.5 px-2.5 py-2 rounded-xl"
          style={{ background: 'hsl(var(--card) / 0.6)', border: '1px solid hsl(var(--border) / 0.5)' }}>
          <p className="text-xs italic leading-snug"
            style={{ color: 'hsl(var(--foreground) / 0.8)' }}>"{card.note}"</p>
        </div>
      )}

      {/* Sent-by footer */}
      <div className="px-3 pb-2.5">
        <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
          {isMine ? 'You shared this' : 'Shared with you'}
        </p>
      </div>
    </div>
  );
}
