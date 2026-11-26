/**
 * SpellfulSharePicker
 * Bottom-sheet for sharing Spellful content in a DM:
 *   - Send a Blessing (no data needed — composed inline)
 *   - Share a Spell (from public spell library)
 *   - Share a Ritual (from user's saved moon rituals)
 *   - Share a Tarot Reading (from user's recent readings)
 *
 * On confirm, calls onShare(card) with a RichCard payload.
 * The caller encrypts + sends it as systemMessage JSON.
 */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, BookOpen, Moon, Layers } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type RichCardType = 'blessing' | 'spell' | 'ritual' | 'tarot_reading';

export interface RichCard {
  type: RichCardType;
  id?: number;
  title: string;
  subtitle?: string;
  meta?: string;       // e.g. "Protection · Beginner · 30 min"
  note?: string;       // personal note added by sender
  emoji?: string;
}

interface SpellOption {
  id: number;
  title: string;
  subtitle: string;
  intention: string;
  difficulty: string;
  durationMinutes: number;
  moonPhase: string;
}

interface RitualOption {
  id: number;
  ritualName: string;
  moonPhase: string;
  intention: string;
  scheduledDate: string;
  createdAt: string;
}

interface TarotOption {
  id: number;
  spreadType: string;
  spreadName: string;
  intention: string;
  moonPhase: string;
  createdAt: string;
  cardCount: number;
}

type Tab = 'blessing' | 'spell' | 'ritual' | 'tarot';

interface Props {
  open: boolean;
  onClose: () => void;
  onShare: (card: RichCard) => void;
}

// ── Blessing presets ──────────────────────────────────────────────────────────

const BLESSINGS = [
  { emoji: '✨', title: 'Wishing you light and clarity', subtitle: 'A blessing of clarity' },
  { emoji: '🌙', title: 'May the moon guide your path', subtitle: 'A lunar blessing' },
  { emoji: '🔮', title: 'Sending you protective energy', subtitle: 'A protection blessing' },
  { emoji: '🌿', title: 'May abundance flow to you', subtitle: 'An abundance blessing' },
  { emoji: '🕯️', title: 'Holding space for your healing', subtitle: 'A healing blessing' },
  { emoji: '⚡', title: 'Sending you strength and courage', subtitle: 'A strength blessing' },
  { emoji: '🌸', title: 'May love surround you always', subtitle: 'A love blessing' },
  { emoji: '🌟', title: 'You are seen, you are valued', subtitle: 'A blessing of affirmation' },
];

const INTENTION_EMOJI: Record<string, string> = {
  protection: '🛡️', love: '❤️', abundance: '🌿', healing: '🕯️',
  clarity: '🔮', banishing: '⚡', divination: '🌙', grounding: '🌍',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SpellfulSharePicker({ open, onClose, onShare }: Props) {
  const [tab, setTab] = useState<Tab>('blessing');
  const [note, setNote] = useState('');

  // Blessing
  const [selectedBlessing, setSelectedBlessing] = useState<typeof BLESSINGS[0] | null>(null);

  // Spell
  const [spells, setSpells] = useState<SpellOption[]>([]);
  const [spellsLoading, setSpellsLoading] = useState(false);
  const [selectedSpell, setSelectedSpell] = useState<SpellOption | null>(null);

  // Ritual
  const [rituals, setRituals] = useState<RitualOption[]>([]);
  const [ritualsLoading, setRitualsLoading] = useState(false);
  const [selectedRitual, setSelectedRitual] = useState<RitualOption | null>(null);

  // Tarot
  const [readings, setReadings] = useState<TarotOption[]>([]);
  const [readingsLoading, setReadingsLoading] = useState(false);
  const [selectedReading, setSelectedReading] = useState<TarotOption | null>(null);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setTab('blessing');
    setNote('');
    setSelectedBlessing(null);
    setSelectedSpell(null);
    setSelectedRitual(null);
    setSelectedReading(null);
  }, [open]);

  // Lazy-load data when tab changes
  useEffect(() => {
    if (!open) return;
    if (tab === 'spell' && spells.length === 0 && !spellsLoading) {
      setSpellsLoading(true);
      fetch('/api/messaging/share-options/spells', { credentials: 'include' })
        .then(r => r.json())
        .then((d: { spells?: SpellOption[] }) => setSpells(d.spells ?? []))
        .catch(() => {})
        .finally(() => setSpellsLoading(false));
    }
    if (tab === 'ritual' && rituals.length === 0 && !ritualsLoading) {
      setRitualsLoading(true);
      fetch('/api/messaging/share-options/rituals', { credentials: 'include' })
        .then(r => r.json())
        .then((d: { rituals?: RitualOption[] }) => setRituals(d.rituals ?? []))
        .catch(() => {})
        .finally(() => setRitualsLoading(false));
    }
    if (tab === 'tarot' && readings.length === 0 && !readingsLoading) {
      setReadingsLoading(true);
      fetch('/api/messaging/share-options/tarot-readings', { credentials: 'include' })
        .then(r => r.json())
        .then((d: { readings?: TarotOption[] }) => setReadings(d.readings ?? []))
        .catch(() => {})
        .finally(() => setReadingsLoading(false));
    }
  }, [open, tab, spells.length, rituals.length, readings.length, spellsLoading, ritualsLoading, readingsLoading]);

  function handleShare() {
    let card: RichCard | null = null;
    if (tab === 'blessing' && selectedBlessing) {
      card = { type: 'blessing', title: selectedBlessing.title, subtitle: selectedBlessing.subtitle, emoji: selectedBlessing.emoji, note: note.trim() || undefined };
    } else if (tab === 'spell' && selectedSpell) {
      const intention = selectedSpell.intention ?? '';
      const difficulty = selectedSpell.difficulty ?? '';
      const intentionEmoji = INTENTION_EMOJI[intention] ?? '✨';
      const intentionLabel = intention ? intention.charAt(0).toUpperCase() + intention.slice(1) : 'Spell';
      const difficultyLabel = difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : '';
      card = {
        type: 'spell', id: selectedSpell.id, title: selectedSpell.title,
        subtitle: selectedSpell.subtitle || undefined,
        meta: [intentionEmoji + ' ' + intentionLabel, difficultyLabel, selectedSpell.durationMinutes ? `${selectedSpell.durationMinutes} min` : ''].filter(Boolean).join(' · '),
        note: note.trim() || undefined, emoji: intentionEmoji,
      };
    } else if (tab === 'ritual' && selectedRitual) {
      card = {
        type: 'ritual', id: selectedRitual.id, title: selectedRitual.ritualName,
        subtitle: selectedRitual.intention ? `Intention: ${selectedRitual.intention}` : undefined,
        meta: `🌙 ${selectedRitual.moonPhase || 'Moon ritual'}`,
        note: note.trim() || undefined, emoji: '🌙',
      };
    } else if (tab === 'tarot' && selectedReading) {
      card = {
        type: 'tarot_reading', id: selectedReading.id, title: selectedReading.spreadName,
        subtitle: selectedReading.intention || undefined,
        meta: `🔮 ${selectedReading.cardCount} card${selectedReading.cardCount !== 1 ? 's' : ''} · ${new Date(selectedReading.createdAt).toLocaleDateString()}`,
        note: note.trim() || undefined, emoji: '🔮',
      };
    }
    if (!card) return;
    onShare(card);
    onClose();
  }

  const canShare = (
    (tab === 'blessing' && selectedBlessing !== null) ||
    (tab === 'spell' && selectedSpell !== null) ||
    (tab === 'ritual' && selectedRitual !== null) ||
    (tab === 'tarot' && selectedReading !== null)
  );

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'blessing', label: 'Blessing', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: 'spell', label: 'Spell', icon: <BookOpen className="w-3.5 h-3.5" /> },
    { id: 'ritual', label: 'Ritual', icon: <Moon className="w-3.5 h-3.5" /> },
    { id: 'tarot', label: 'Tarot', icon: <Layers className="w-3.5 h-3.5" /> },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl shadow-2xl flex flex-col"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', maxHeight: '85vh' }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div className="w-10 h-1 rounded-full" style={{ background: 'hsl(var(--muted-foreground) / 0.3)' }} />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 flex-shrink-0">
              <p className="font-serif text-lg" style={{ color: 'hsl(var(--foreground))' }}>Share something magical</p>
              <button onClick={onClose} style={{ color: 'hsl(var(--muted-foreground))' }} aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="flex gap-1 px-4 pb-3 flex-shrink-0">
              {tabs.map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setNote(''); }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    background: tab === t.id ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                    color: tab === t.id ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    border: tab === t.id ? '1px solid hsl(var(--primary) / 0.3)' : '1px solid transparent',
                  }}>
                  {t.icon}{t.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-2 flex flex-col gap-2">
              {tab === 'blessing' && (
                <>
                  <p className="text-xs mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Choose a blessing to send:</p>
                  {BLESSINGS.map(b => (
                    <button key={b.title} onClick={() => setSelectedBlessing(b)}
                      className="flex items-center gap-3 p-3 rounded-2xl text-left transition-all active:opacity-70"
                      style={{
                        background: selectedBlessing?.title === b.title ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                        border: selectedBlessing?.title === b.title ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                      }}>
                      <span className="text-2xl flex-shrink-0">{b.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>{b.title}</p>
                        <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{b.subtitle}</p>
                      </div>
                    </button>
                  ))}
                </>
              )}

              {tab === 'spell' && (
                <>
                  {spellsLoading ? (
                    <LoadingSpinner />
                  ) : spells.length === 0 ? (
                    <EmptyState emoji="📖" message="No spells available yet" />
                  ) : (
                    spells.map(s => (
                      <button key={s.id} onClick={() => setSelectedSpell(s)}
                        className="flex items-start gap-3 p-3 rounded-2xl text-left transition-all active:opacity-70"
                        style={{
                          background: selectedSpell?.id === s.id ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                          border: selectedSpell?.id === s.id ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                        }}>
                        <span className="text-xl flex-shrink-0 mt-0.5">{INTENTION_EMOJI[s.intention] ?? '✨'}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>{s.title}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {s.intention.charAt(0).toUpperCase() + s.intention.slice(1)} · {s.difficulty.charAt(0).toUpperCase() + s.difficulty.slice(1)} · {s.durationMinutes} min
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}

              {tab === 'ritual' && (
                <>
                  {ritualsLoading ? (
                    <LoadingSpinner />
                  ) : rituals.length === 0 ? (
                    <EmptyState emoji="🌙" message="No saved rituals yet — create one in Moon Rituals" />
                  ) : (
                    rituals.map(r => (
                      <button key={r.id} onClick={() => setSelectedRitual(r)}
                        className="flex items-start gap-3 p-3 rounded-2xl text-left transition-all active:opacity-70"
                        style={{
                          background: selectedRitual?.id === r.id ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                          border: selectedRitual?.id === r.id ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                        }}>
                        <span className="text-xl flex-shrink-0 mt-0.5">🌙</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>{r.ritualName}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {r.moonPhase || 'Moon ritual'}{r.intention ? ` · ${r.intention}` : ''}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}

              {tab === 'tarot' && (
                <>
                  {readingsLoading ? (
                    <LoadingSpinner />
                  ) : readings.length === 0 ? (
                    <EmptyState emoji="🔮" message="No tarot readings yet — do a reading first" />
                  ) : (
                    readings.map(r => (
                      <button key={r.id} onClick={() => setSelectedReading(r)}
                        className="flex items-start gap-3 p-3 rounded-2xl text-left transition-all active:opacity-70"
                        style={{
                          background: selectedReading?.id === r.id ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
                          border: selectedReading?.id === r.id ? '1px solid hsl(var(--primary) / 0.4)' : '1px solid transparent',
                        }}>
                        <span className="text-xl flex-shrink-0 mt-0.5">🔮</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>{r.spreadName}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            {r.cardCount} card{r.cardCount !== 1 ? 's' : ''} · {new Date(r.createdAt).toLocaleDateString()}
                            {r.intention ? ` · ${r.intention}` : ''}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </>
              )}
            </div>

            {/* Personal note + send */}
            <div className="px-4 pt-2 pb-6 flex flex-col gap-2 flex-shrink-0" style={{ borderTop: '1px solid hsl(var(--border))' }}>
              {canShare && (
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Add a personal note… (optional)"
                  maxLength={200}
                  className="w-full rounded-xl px-3 py-2 text-sm"
                  style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' }}
                />
              )}
              <button
                onClick={handleShare}
                disabled={!canShare}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                ✨ Send
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-10">
      <span className="w-6 h-6 rounded-full border-2 border-current border-t-transparent animate-spin"
        style={{ color: 'hsl(var(--primary))' }} />
    </div>
  );
}

function EmptyState({ emoji, message }: { emoji: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <span className="text-3xl">{emoji}</span>
      <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>{message}</p>
    </div>
  );
}
