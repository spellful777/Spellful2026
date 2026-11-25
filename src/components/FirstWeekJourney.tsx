/**
 * FirstWeekJourney
 *
 * 7-day gentle in-product onboarding prompts shown on the dashboard.
 * - One task per day, revealed progressively as days pass since account creation
 * - Progress tracked in dashboardPreferences.firstWeekProgress (server-persisted)
 * - Skippable/dismissible — does not reappear after completion or dismissal
 * - Disappears automatically after 14 days (grace period)
 *
 * Day tasks:
 *   Day 1 — Personalise your dashboard
 *   Day 2 — Write your first Grimoire entry
 *   Day 3 — Draw your Card of the Day
 *   Day 4 — Join the Coven community
 *   Day 5 — Set your moon ritual intention
 *   Day 6 — Explore the Tarot library
 *   Day 7 — Complete your profile
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, X, Sparkles } from 'lucide-react';
import { Link } from 'react-router';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FirstWeekProgress {
  completedDays: number[];
  dismissedAt: string | null;
  startedAt: string;
}

interface Props {
  /** ISO string of when the user first completed the OnboardingWizard */
  startedAt?: string | null;
  /** Raw firstWeekProgress from dashboardPreferences */
  savedProgress?: FirstWeekProgress | null;
  /** Called whenever progress changes so the parent can persist it */
  onProgressChange?: (p: FirstWeekProgress) => void;
}

// ── Task definitions ──────────────────────────────────────────────────────────
interface JourneyTask {
  day: number;
  emoji: string;
  title: string;
  description: string;
  cta: string;
  href: string;
}

const TASKS: JourneyTask[] = [
  {
    day: 1,
    emoji: '\u2728',
    title: 'Personalise your dashboard',
    description: 'Add or rearrange widgets to make your magical space your own.',
    cta: 'Customise dashboard',
    href: '/dashboard',
  },
  {
    day: 2,
    emoji: '\u{1F4D6}',
    title: 'Write your first Grimoire entry',
    description: 'Capture a spell, dream, or intention in your Book of Shadows.',
    cta: 'Open Grimoire',
    href: '/grimoire',
  },
  {
    day: 3,
    emoji: '\u{1F0CF}',
    title: 'Draw your Card of the Day',
    description: 'Pull a daily tarot card and sit with its message.',
    cta: 'Draw a card',
    href: '/tarot',
  },
  {
    day: 4,
    emoji: '\u{1F525}',
    title: 'Join the Coven community',
    description: 'Introduce yourself, read a discussion, or share a thought.',
    cta: 'Visit the Coven',
    href: '/community',
  },
  {
    day: 5,
    emoji: '\u{1F319}',
    title: 'Set your moon ritual intention',
    description: 'Check the current moon phase and write an intention aligned with it.',
    cta: 'See moon phase',
    href: '/moon',
  },
  {
    day: 6,
    emoji: '\u{1F52E}',
    title: 'Explore the Tarot library',
    description: 'Browse card meanings, spreads, and interpretations.',
    cta: 'Explore Tarot',
    href: '/tarot',
  },
  {
    day: 7,
    emoji: '\u{1F9D9}',
    title: 'Complete your profile',
    description: 'Add your witch path, bio, and a profile photo so the Coven can find you.',
    cta: 'Edit profile',
    href: '/profile/edit',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysSince(isoDate: string): number {
  const start = new Date(isoDate).getTime();
  return Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24));
}

function unlockedDays(startedAt: string): number[] {
  const elapsed = daysSince(startedAt);
  const count = Math.min(elapsed + 1, 7);
  return Array.from({ length: count }, (_, i) => i + 1);
}

// ── TaskRow ───────────────────────────────────────────────────────────────────
function TaskRow({
  task, completed, unlocked, onComplete,
}: {
  task: JourneyTask;
  completed: boolean;
  unlocked: boolean;
  onComplete: (day: number) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-3" style={{ opacity: unlocked ? 1 : 0.4 }}>
      <button
        type="button"
        disabled={!unlocked || completed}
        onClick={() => onComplete(task.day)}
        className="shrink-0 mt-0.5 transition-transform hover:scale-110 disabled:cursor-default"
        aria-label={completed ? 'Completed' : 'Mark complete'}
      >
        {completed ? (
          <CheckCircle2 size={20} strokeWidth={2} style={{ color: 'hsl(var(--primary))' }} />
        ) : (
          <Circle
            size={20}
            strokeWidth={1.5}
            style={{ color: unlocked ? 'hsl(var(--muted-foreground))' : 'hsl(var(--border))' }}
          />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span aria-hidden="true" className="text-sm">{task.emoji}</span>
          <p
            className="text-sm font-semibold"
            style={{
              fontFamily: 'var(--font-heading)',
              color: completed ? 'hsl(var(--muted-foreground))' : 'hsl(var(--foreground))',
              textDecoration: completed ? 'line-through' : 'none',
            }}
          >
            Day {task.day} — {task.title}
          </p>
        </div>
        {!completed && unlocked && (
          <p
            className="text-xs mt-0.5"
            style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
          >
            {task.description}
          </p>
        )}
        {!completed && unlocked && (
          <Link
            to={task.href}
            onClick={() => onComplete(task.day)}
            className="inline-block mt-1.5 text-xs font-medium underline underline-offset-2 transition-opacity hover:opacity-70"
            style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
          >
            {task.cta} &rarr;
          </Link>
        )}
      </div>

      <span
        className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
        style={{
          background: unlocked && !completed ? 'hsl(var(--primary) / 0.15)' : 'hsl(var(--muted))',
          color: unlocked && !completed ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
          fontFamily: 'var(--font-sans)',
        }}
      >
        {unlocked ? (completed ? 'Done' : 'Today') : 'Locked'}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FirstWeekJourney({ startedAt, savedProgress, onProgressChange }: Props) {
  const [progress, setProgress] = useState<FirstWeekProgress | null>(null);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (savedProgress) {
      setProgress(savedProgress);
      return;
    }
    const now = new Date().toISOString();
    setProgress({ completedDays: [], dismissedAt: null, startedAt: startedAt ?? now });
  }, [savedProgress, startedAt]);

  const persist = useCallback((next: FirstWeekProgress) => {
    setProgress(next);
    onProgressChange?.(next);
    fetch('/api/dashboard/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ firstWeekProgress: next }),
    }).catch(() => { /* non-fatal */ });
  }, [onProgressChange]);

  const handleComplete = useCallback((day: number) => {
    if (!progress || progress.completedDays.includes(day)) return;
    persist({ ...progress, completedDays: [...progress.completedDays, day] });
  }, [progress, persist]);

  const handleDismiss = useCallback(() => {
    if (!progress) return;
    persist({ ...progress, dismissedAt: new Date().toISOString() });
  }, [progress, persist]);

  if (!progress) return null;
  if (progress.dismissedAt) return null;
  if (progress.completedDays.length >= 7) return null;
  if (daysSince(progress.startedAt) > 14) return null;

  const unlocked = unlockedDays(progress.startedAt);
  const completedCount = progress.completedDays.length;
  const progressPct = Math.round((completedCount / 7) * 100);
  const nextTask = TASKS.find(t => unlocked.includes(t.day) && !progress.completedDays.includes(t.day));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.35, ease: 'easeOut' as const }}
        className="max-w-6xl mx-auto px-4 sm:px-6 pt-4"
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-4 pb-3">
            <div
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'hsl(var(--primary) / 0.15)' }}
            >
              <Sparkles size={15} style={{ color: 'hsl(var(--primary))' }} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold leading-tight"
                style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
              >
                Your first week of magic
              </p>
              <p
                className="text-[11px]"
                style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
              >
                {completedCount} of 7 tasks complete
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setExpanded(e => !e)}
                className="p-1 rounded-full transition-opacity hover:opacity-70"
                aria-label={expanded ? 'Collapse' : 'Expand'}
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                {expanded
                  ? <ChevronUp size={16} strokeWidth={2} />
                  : <ChevronDown size={16} strokeWidth={2} />}
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="p-1 rounded-full transition-opacity hover:opacity-70"
                aria-label="Dismiss first-week journey"
                style={{ color: 'hsl(var(--muted-foreground))' }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div
            className="mx-5 mb-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: 'hsl(var(--muted))' }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'hsl(var(--primary))' }}
              initial={{ width: 0 }}
              animate={{ width: progressPct + '%' }}
              transition={{ duration: 0.5, ease: 'easeOut' as const }}
            />
          </div>

          {/* Collapsed: next task only */}
          <AnimatePresence initial={false}>
            {!expanded && nextTask && (
              <motion.div
                key="collapsed"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-4 pt-2">
                  <p
                    className="text-xs"
                    style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
                  >
                    <span aria-hidden="true">{nextTask.emoji} </span>
                    <span style={{ color: 'hsl(var(--foreground))' }}>Up next:</span>{' '}
                    {nextTask.title}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Expanded: full list */}
            {expanded && (
              <motion.div
                key="expanded"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22 }}
                className="overflow-hidden"
              >
                <div
                  className="px-5 pb-2 divide-y"
                  style={{ borderColor: 'hsl(var(--border) / 0.5)' }}
                >
                  {TASKS.map(task => (
                    <TaskRow
                      key={task.day}
                      task={task}
                      completed={progress.completedDays.includes(task.day)}
                      unlocked={unlocked.includes(task.day)}
                      onComplete={handleComplete}
                    />
                  ))}
                </div>
                <div className="px-5 pb-4 text-center">
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-xs transition-opacity hover:opacity-70"
                    style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
                  >
                    I&apos;ll explore on my own &rarr;
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
