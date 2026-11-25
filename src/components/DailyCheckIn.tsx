/**
 * DailyCheckIn
 *
 * Optional daily check-in widget shown on the dashboard between the hero
 * and the widget grid. Features:
 *   - Moon phase greeting personalised to today's phase
 *   - One-tap mood selection (10 options)
 *   - One-tap intention selection (10 options)
 *   - Optional "Save to Grimoire" toggle
 *   - Streak counter
 *   - Dismissible for the session (does not reappear until next day)
 *   - Does not render if already completed today
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Flame, BookOpen, Check } from 'lucide-react';

// -- Types --------------------------------------------------------------------
interface CheckinState {
  completed: boolean;
  checkin: { mood: string; intention: string; streakCount: number } | null;
  streak: number;
  moonPhase: string;
  moonIllumination: number;
}

// -- Data ---------------------------------------------------------------------
const MOODS: { id: string; label: string; emoji: string }[] = [
  { id: 'grounded',   label: 'Grounded',   emoji: '🪨' },
  { id: 'curious',    label: 'Curious',    emoji: '✨' },
  { id: 'restless',   label: 'Restless',   emoji: '🌀' },
  { id: 'grateful',   label: 'Grateful',   emoji: '💛' },
  { id: 'hopeful',    label: 'Hopeful',    emoji: '🌱' },
  { id: 'tender',     label: 'Tender',     emoji: '🌹' },
  { id: 'energised',  label: 'Energised',  emoji: '⚡' },
  { id: 'reflective', label: 'Reflective', emoji: '🌌' },
  { id: 'playful',    label: 'Playful',    emoji: '🧸' },
  { id: 'weary',      label: 'Weary',      emoji: '🌫' },
];

const INTENTIONS: { id: string; label: string; emoji: string }[] = [
  { id: 'clarity',    label: 'Clarity',    emoji: '🔮' },
  { id: 'healing',    label: 'Healing',    emoji: '🧿' },
  { id: 'creativity', label: 'Creativity', emoji: '🖌' },
  { id: 'protection', label: 'Protection', emoji: '🛡' },
  { id: 'abundance',  label: 'Abundance',  emoji: '💫' },
  { id: 'love',       label: 'Love',       emoji: '🧡' },
  { id: 'release',    label: 'Release',    emoji: '🍃' },
  { id: 'growth',     label: 'Growth',     emoji: '🌿' },
  { id: 'peace',      label: 'Peace',      emoji: '🕊' },
  { id: 'courage',    label: 'Courage',    emoji: '🔥' },
];

const MOON_GREETINGS: Record<string, string> = {
  'New Moon':         'A new cycle begins. Set your intentions.',
  'Waxing Crescent':  'The light grows. What are you calling in?',
  'First Quarter':    'Momentum is building. Take action.',
  'Waxing Gibbous':   'Almost full. Tend to what you have planted.',
  'Full Moon':        'The veil is thin. Feel everything.',
  'Waning Gibbous':   'Share your gifts. Give back.',
  'Last Quarter':     'Release what no longer serves you.',
  'Waning Crescent':  'Rest and restore. The cycle nears its end.',
};

const MOON_EMOJIS: Record<string, string> = {
  'New Moon': '🌑',
  'Waxing Crescent': '🌒',
  'First Quarter': '🌓',
  'Waxing Gibbous': '🌔',
  'Full Moon': '🌕',
  'Waning Gibbous': '🌖',
  'Last Quarter': '🌗',
  'Waning Crescent': '🌘',
};

// -- Chip component -----------------------------------------------------------
function Chip({
  emoji, label, selected, onClick,
}: { emoji: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
      style={{
        background: selected ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
        color: selected ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
        border: selected ? '1px solid hsl(var(--primary))' : '1px solid transparent',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <span aria-hidden="true">{emoji}</span>
      {label}
    </button>
  );
}

// -- Completion card ----------------------------------------------------------
function CompletionCard({
  mood, intention, streak, moonPhase, onDismiss,
}: {
  mood: string; intention: string; streak: number; moonPhase: string; onDismiss: () => void;
}) {
  const moodItem = MOODS.find(m => m.id === mood);
  const intentionItem = INTENTIONS.find(i => i.id === intention);
  const moonEmoji = MOON_EMOJIS[moonPhase] ?? '🌙';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.3, ease: 'easeOut' as const }}
      className="relative rounded-2xl p-5 flex items-start gap-4"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.12) 0%, hsl(var(--accent) / 0.08) 100%)',
        border: '1px solid hsl(var(--primary) / 0.3)',
      }}
    >
      <div
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'hsl(var(--primary) / 0.2)' }}
      >
        <Check size={18} style={{ color: 'hsl(var(--primary))' }} strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-semibold mb-0.5"
          style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
        >
          Check-in complete {moonEmoji}
        </p>
        <p
          className="text-xs"
          style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
        >
          {moodItem?.emoji} {moodItem?.label} &middot; {intentionItem?.emoji} {intentionItem?.label}
        </p>
        {streak > 1 && (
          <p
            className="text-xs mt-1 flex items-center gap-1"
            style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
          >
            <Flame size={11} strokeWidth={2} />
            {streak}-day streak
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-1 rounded-full transition-opacity hover:opacity-70"
        aria-label="Dismiss check-in"
        style={{ color: 'hsl(var(--muted-foreground))' }}
      >
        <X size={14} strokeWidth={2} />
      </button>
    </motion.div>
  );
}

// -- Main component -----------------------------------------------------------
export default function DailyCheckIn() {
  const [state, setState] = useState<CheckinState | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [selectedIntention, setSelectedIntention] = useState<string | null>(null);
  const [saveToGrimoire, setSaveToGrimoire] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  // Load today's state
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/checkin/today');
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as CheckinState;
        if (!cancelled) setState(data);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit() {
    if (!selectedMood || !selectedIntention || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/checkin/today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mood: selectedMood, intention: selectedIntention, saveToGrimoire }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { checkin: { mood: string; intention: string; streakCount: number }; streak: number };
      setState(prev => prev ? { ...prev, completed: true, checkin: data.checkin, streak: data.streak } : prev);
      setJustCompleted(true);
    } catch { /* silent */ } finally {
      setSubmitting(false);
    }
  }

  // Don't render while loading, or if dismissed
  if (loading || dismissed) return null;
  if (!state) return null;

  const moonEmoji = MOON_EMOJIS[state.moonPhase] ?? '🌙';
  const moonGreeting = MOON_GREETINGS[state.moonPhase] ?? 'How are you feeling today?';

  // Already completed — show compact completion card
  if (state.completed && state.checkin) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4">
        <AnimatePresence>
          {!dismissed && (
            <CompletionCard
              mood={state.checkin.mood}
              intention={state.checkin.intention}
              streak={state.streak}
              moonPhase={state.moonPhase}
              onDismiss={() => setDismissed(true)}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  const canSubmit = !!selectedMood && !!selectedIntention && !submitting;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: 'easeOut' as const }}
          className="max-w-6xl mx-auto px-4 sm:px-6 pt-4"
        >
          <div
            className="rounded-2xl p-5 relative"
            style={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
            }}
          >
            {/* Dismiss */}
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="absolute top-4 right-4 p-1 rounded-full transition-opacity hover:opacity-70"
              aria-label="Dismiss daily check-in"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <X size={14} strokeWidth={2} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl" aria-hidden="true">{moonEmoji}</span>
              <p
                className="text-[10px] font-semibold tracking-widest uppercase"
                style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
              >
                Daily Check-In
              </p>
              {state.streak > 0 && (
                <span
                  className="ml-auto flex items-center gap-1 text-xs font-medium"
                  style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
                >
                  <Flame size={12} strokeWidth={2} />
                  {state.streak}-day streak
                </span>
              )}
            </div>
            <p
              className="text-sm mb-4"
              style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
            >
              {moonGreeting}
            </p>

            {/* Mood */}
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}
            >
              How are you feeling?
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {MOODS.map(m => (
                <Chip
                  key={m.id}
                  emoji={m.emoji}
                  label={m.label}
                  selected={selectedMood === m.id}
                  onClick={() => setSelectedMood(m.id)}
                />
              ))}
            </div>

            {/* Intention */}
            <p
              className="text-xs font-semibold mb-2"
              style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}
            >
              Set your intention
            </p>
            <div className="flex flex-wrap gap-2 mb-4">
              {INTENTIONS.map(i => (
                <Chip
                  key={i.id}
                  emoji={i.emoji}
                  label={i.label}
                  selected={selectedIntention === i.id}
                  onClick={() => setSelectedIntention(i.id)}
                />
              ))}
            </div>

            {/* Save to grimoire toggle + submit */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label
                className="flex items-center gap-2 cursor-pointer select-none"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                <input
                  type="checkbox"
                  checked={saveToGrimoire}
                  onChange={e => setSaveToGrimoire(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span
                  className="flex items-center gap-1 text-xs"
                  style={{ color: 'hsl(var(--muted-foreground))' }}
                >
                  <BookOpen size={12} strokeWidth={1.8} />
                  Save to Grimoire
                </span>
              </label>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-opacity disabled:opacity-40"
                style={{
                  background: 'hsl(var(--primary))',
                  color: 'hsl(var(--primary-foreground))',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {submitting ? 'Saving…' : 'Check in'}
              </button>
            </div>

            {/* Just-completed flash */}
            <AnimatePresence>
              {justCompleted && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-xs mt-3 text-center"
                  style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
                >
                  ✨ Intentions set. May your day be magical.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
