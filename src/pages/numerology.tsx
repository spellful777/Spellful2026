import { numerology } from 'virtual:content';
/**
 * /numerology — Spellful Numerology Discovery Center
 *
 * Phase 1 implementation per Spellful_Numerology_Improvement_Plan.txt:
 * - Improved calculator UX with transparent Pythagorean calculation steps
 * - Master-number preservation (11, 22, 33) with documented convention
 * - Life Path, Destiny/Expression, Soul Urge, Personality, Birthday, Personal Year
 * - Number Library (1–9 + master numbers 11, 22, 33)
 * - Angel / Repeating Numbers section
 * - History & Traditions article
 * - Accessible tabs, anchor links, reduced-motion support
 * - No stored personal data; guest use; no forced registration
 *
 * Calculation convention: Modern Pythagorean
 *   Life Path — reduce month, day, and year separately, then sum and reduce
 *   (master numbers 11, 22, 33 preserved at each intermediate step)
 *   Expression/Destiny — all letters; Soul Urge — vowels (Y treated as consonant);
 *   Personality — consonants; Birthday — day of birth reduced
 *   Personal Year — birth month + birth day + current calendar year, reduced
 */

import { useState, useRef } from 'react';
import { useSession } from '@/lib/auth/auth-client';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Hash, Sparkles, BookOpen, Clock, ChevronDown, ChevronUp, Info } from 'lucide-react';

// ─── Pythagorean letter map ────────────────────────────────────────────────
// 1=AJS  2=BKT  3=CLU  4=DMV  5=ENW  6=FOX  7=GPY  8=HQZ  9=IR
// Y is treated as a consonant in this implementation (common modern convention).
// Non-Latin characters and diacritics are currently not mapped; they are skipped
// with a note shown to the user.
const LETTER_MAP: Record<string, number> = {
  a:1,b:2,c:3,d:4,e:5,f:6,g:7,h:8,i:9,
  j:1,k:2,l:3,m:4,n:5,o:6,p:7,q:8,r:9,
  s:1,t:2,u:3,v:4,w:5,x:6,y:7,z:8,
};
const VOWELS = new Set(['a','e','i','o','u']); // Y treated as consonant

// ─── Reduction helpers ─────────────────────────────────────────────────────

/** Reduce a number to a single digit, preserving master numbers 11, 22, 33. */
function reduce(n: number): number {
  if (n === 11 || n === 22 || n === 33) return n;
  if (n < 10) return n;
  const next = String(n).split('').reduce((a, d) => a + parseInt(d, 10), 0);
  return reduce(next);
}

/** Digit-sum of a number string (no master-number preservation at this level). */
function digitSum(s: string): number {
  return s.replace(/\D/g, '').split('').reduce((a, d) => a + parseInt(d, 10), 0);
}

// ─── Life Path ─────────────────────────────────────────────────────────────

interface LifePathSteps {
  month: number; monthReduced: number;
  day: number;   dayReduced: number;
  year: number;  yearReduced: number;
  total: number; result: number;
}

function calcLifePath(dateStr: string): LifePathSteps | null {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const monthReduced = reduce(m);
  const dayReduced   = reduce(d);
  const yearReduced  = reduce(digitSum(String(y)));
  const total        = monthReduced + dayReduced + yearReduced;
  const result       = reduce(total);
  return { month: m, monthReduced, day: d, dayReduced, year: y, yearReduced, total, result };
}

// ─── Name-based numbers ────────────────────────────────────────────────────

interface NameSteps {
  letters: Array<{ char: string; value: number; isVowel: boolean }>;
  expressionTotal: number; expression: number;
  soulTotal: number;       soulUrge: number;
  personalityTotal: number; personality: number;
  birthday: number;
  skippedChars: string[];
}

function calcNameNumbers(name: string, birthdayDay?: number): NameSteps {
  const lower = name.toLowerCase();
  const letters: NameSteps['letters'] = [];
  const skippedChars: string[] = [];

  for (const ch of lower) {
    if (/[a-z]/.test(ch)) {
      // eslint-disable-next-line security/detect-object-injection
      letters.push({ char: ch, value: LETTER_MAP[ch] ?? 0, isVowel: VOWELS.has(ch) });
    } else if (/[^a-z\s'-]/.test(ch)) {
      // Non-Latin or unsupported — note it
      if (!skippedChars.includes(ch)) skippedChars.push(ch);
    }
    // Spaces, hyphens, apostrophes are silently ignored (standard practice)
  }

  const expressionTotal = letters.reduce((a, l) => a + l.value, 0);
  const soulTotal       = letters.filter(l => l.isVowel).reduce((a, l) => a + l.value, 0);
  const personalityTotal = letters.filter(l => !l.isVowel).reduce((a, l) => a + l.value, 0);

  return {
    letters,
    expressionTotal, expression: reduce(expressionTotal),
    soulTotal,       soulUrge: reduce(soulTotal),
    personalityTotal, personality: reduce(personalityTotal),
    birthday: birthdayDay ? reduce(birthdayDay) : 0,
    skippedChars,
  };
}

// ─── Personal Year ─────────────────────────────────────────────────────────

function calcPersonalYear(dateStr: string, targetYear: number): { total: number; result: number } | null {
  if (!dateStr) return null;
  const [, m, d] = dateStr.split('-').map(Number);
  if (!m || !d) return null;
  const total = reduce(m) + reduce(d) + reduce(digitSum(String(targetYear)));
  return { total, result: reduce(total) };
}

// ─── Number meanings ───────────────────────────────────────────────────────

interface NumberMeaning {
  archetype: string;
  overview: string;
  strengths: string[];
  shadows: string[];
  journalPrompt: string;
  keywords: string[];
  color: string; // Tailwind bg class for accent dot
}

const MEANINGS: Record<number, NumberMeaning> = {
  1: {
    archetype: 'The Pioneer',
    overview: 'Number 1 carries the energy of beginnings, independence, and self-determination. In modern numerology it is associated with leadership, initiative, and the courage to forge a new path. As a Life Path it suggests a journey centered on developing individuality and confidence; as an Expression number it points toward roles where originality and self-reliance are assets.',
    strengths: ['Leadership', 'Independence', 'Originality', 'Ambition', 'Courage'],
    shadows: ['Isolation', 'Impatience', 'Stubbornness', 'Difficulty collaborating'],
    journalPrompt: 'Where in your life are you being called to take the lead, and what holds you back from stepping forward?',
    keywords: ['Beginnings', 'Self', 'Initiative', 'Drive'],
    color: 'bg-primary',
  },
  2: {
    archetype: 'The Peacemaker',
    overview: 'Number 2 is associated with cooperation, sensitivity, and the art of partnership. Modern numerology connects it with diplomacy, empathy, and the ability to hold space for others. As a Life Path it suggests a journey of learning to balance personal needs with the needs of relationships; as a Soul Urge it may point to a deep inner longing for harmony and connection.',
    strengths: ['Empathy', 'Diplomacy', 'Patience', 'Intuition', 'Cooperation'],
    shadows: ['Indecision', 'Over-sensitivity', 'People-pleasing', 'Difficulty with boundaries'],
    journalPrompt: 'How do you balance your own needs with the needs of those you care for? Where might you need to set a clearer boundary?',
    keywords: ['Partnership', 'Balance', 'Harmony', 'Sensitivity'],
    color: 'bg-accent',
  },
  3: {
    archetype: 'The Creator',
    overview: 'Number 3 is linked to self-expression, creativity, and communication. In modern numerology it is associated with joy, imagination, and the ability to uplift others through art, words, or humor. As a Life Path it suggests a journey of learning to channel creative energy with focus; as an Expression number it often appears in people drawn to artistic or communicative work.',
    strengths: ['Creativity', 'Communication', 'Optimism', 'Charm', 'Imagination'],
    shadows: ['Scattered focus', 'Superficiality', 'Moodiness', 'Difficulty with follow-through'],
    journalPrompt: 'What creative project or form of expression have you been putting off? What would it feel like to begin it today?',
    keywords: ['Expression', 'Joy', 'Creativity', 'Communication'],
    color: 'bg-secondary',
  },
  4: {
    archetype: 'The Builder',
    overview: 'Number 4 is associated with structure, discipline, and the patient work of building something lasting. Modern numerology connects it with reliability, practicality, and a methodical approach to life. As a Life Path it suggests a journey of learning to create stable foundations; as a Personality number it may indicate someone others perceive as dependable and grounded.',
    strengths: ['Discipline', 'Reliability', 'Organization', 'Loyalty', 'Practicality'],
    shadows: ['Rigidity', 'Resistance to change', 'Overwork', 'Difficulty with spontaneity'],
    journalPrompt: 'What routine supports you most right now, and where could you allow a little more flexibility or play?',
    keywords: ['Structure', 'Foundation', 'Work', 'Stability'],
    color: 'bg-primary',
  },
  5: {
    archetype: 'The Explorer',
    overview: 'Number 5 is linked to freedom, adaptability, and a love of experience. In modern numerology it is associated with curiosity, versatility, and a restless desire to learn through direct engagement with the world. As a Life Path it suggests a journey of learning to channel freedom-seeking energy constructively; as a Soul Urge it may point to a deep inner need for variety and independence.',
    strengths: ['Adaptability', 'Curiosity', 'Versatility', 'Charisma', 'Resourcefulness'],
    shadows: ['Restlessness', 'Impulsiveness', 'Difficulty with commitment', 'Overindulgence'],
    journalPrompt: 'What new experience or area of learning is calling to you? How might you explore it in a grounded, sustainable way?',
    keywords: ['Freedom', 'Change', 'Adventure', 'Versatility'],
    color: 'bg-accent',
  },
  6: {
    archetype: 'The Nurturer',
    overview: 'Number 6 is associated with care, responsibility, and the creation of harmony in home and community. Modern numerology connects it with compassion, service, and a strong sense of duty toward others. As a Life Path it suggests a journey of learning to give generously without losing oneself; as an Expression number it often appears in people drawn to healing, teaching, or caregiving roles.',
    strengths: ['Compassion', 'Responsibility', 'Healing', 'Creativity', 'Loyalty'],
    shadows: ['Perfectionism', 'Self-sacrifice', 'Worry', 'Difficulty accepting help'],
    journalPrompt: 'Where are you giving more than you have? What would it look like to care for yourself with the same generosity you offer others?',
    keywords: ['Care', 'Harmony', 'Responsibility', 'Service'],
    color: 'bg-secondary',
  },
  7: {
    archetype: 'The Seeker',
    overview: 'Number 7 is linked to introspection, analysis, and the pursuit of deeper understanding. In modern numerology it is associated with wisdom, spiritual inquiry, and a preference for depth over surface. As a Life Path it suggests a journey of learning to trust both intellect and intuition; as a Soul Urge it may point to a deep inner need for solitude and meaning.',
    strengths: ['Intuition', 'Analysis', 'Wisdom', 'Depth', 'Spiritual awareness'],
    shadows: ['Isolation', 'Secrecy', 'Overthinking', 'Difficulty with vulnerability'],
    journalPrompt: 'What question have you been sitting with lately? What would it mean to trust your intuition alongside your analysis?',
    keywords: ['Wisdom', 'Introspection', 'Mystery', 'Inquiry'],
    color: 'bg-primary',
  },
  8: {
    archetype: 'The Achiever',
    overview: 'Number 8 is associated with ambition, authority, and the mastery of material and organizational challenges. Modern numerology connects it with business acumen, resilience, and the ability to work effectively within systems of power. As a Life Path it suggests a journey of learning to use influence wisely; as an Expression number it often appears in people drawn to leadership, finance, or large-scale projects.',
    strengths: ['Ambition', 'Authority', 'Resilience', 'Organization', 'Strategic thinking'],
    shadows: ['Materialism', 'Control', 'Overwork', 'Difficulty delegating'],
    journalPrompt: 'How do you relate to power and success? Where might you be working harder than necessary, and what would it mean to trust others more?',
    keywords: ['Power', 'Ambition', 'Achievement', 'Authority'],
    color: 'bg-accent',
  },
  9: {
    archetype: 'The Humanitarian',
    overview: 'Number 9 is linked to compassion, completion, and a broad concern for humanity. In modern numerology it is associated with idealism, generosity, and the wisdom that comes from experience. As a Life Path it suggests a journey of learning to give without expectation and to release what no longer serves; as a Soul Urge it may point to a deep inner longing to contribute to something larger than oneself.',
    strengths: ['Compassion', 'Generosity', 'Wisdom', 'Idealism', 'Creativity'],
    shadows: ['Martyrdom', 'Impracticality', 'Difficulty receiving', 'Emotional intensity'],
    journalPrompt: 'What are you ready to release or complete? How might letting go of something old create space for something new?',
    keywords: ['Completion', 'Compassion', 'Wisdom', 'Service'],
    color: 'bg-secondary',
  },
  11: {
    archetype: 'The Intuitive',
    overview: 'In modern numerology, 11 is called a master number — a number that is not reduced further in most schools of thought, though conventions vary. It is associated with heightened intuition, inspiration, and a sensitivity that can be both a gift and a challenge. Note that not all numerology traditions recognize master numbers, and those that do may handle them differently. As a Life Path it suggests a journey of learning to channel sensitivity into creative or spiritual contribution.',
    strengths: ['Intuition', 'Inspiration', 'Empathy', 'Spiritual awareness', 'Creativity'],
    shadows: ['Anxiety', 'Overwhelm', 'High sensitivity', 'Difficulty with practical matters'],
    journalPrompt: 'When do you feel most in tune with your intuition? What helps you stay grounded when your sensitivity feels overwhelming?',
    keywords: ['Intuition', 'Inspiration', 'Sensitivity', 'Vision'],
    color: 'bg-primary',
  },
  22: {
    archetype: 'The Master Builder',
    overview: 'In modern numerology, 22 is called a master number associated with the ability to translate large visions into practical reality. Like all master numbers, its recognition varies by tradition. As a Life Path it suggests a journey of learning to balance grand ambition with the patience and discipline required to build something lasting. The pressure associated with this number in popular numerology is a contemporary interpretation, not an ancient teaching.',
    strengths: ['Vision', 'Practicality', 'Leadership', 'Discipline', 'Manifestation'],
    shadows: ['Perfectionism', 'Pressure', 'Overwhelm', 'Difficulty starting'],
    journalPrompt: 'What large vision are you working toward? What one practical step could you take this week to move it forward?',
    keywords: ['Vision', 'Manifestation', 'Discipline', 'Legacy'],
    color: 'bg-accent',
  },
  33: {
    archetype: 'The Teacher',
    overview: 'In modern numerology, 33 is sometimes called a master number associated with compassion, teaching, and selfless service. It is the rarest of the commonly recognized master numbers, and many numerologists only count it when it appears as a final Life Path result — not as an intermediate sum. As with all master numbers, traditions differ significantly on whether and how to recognize it.',
    strengths: ['Compassion', 'Teaching', 'Healing', 'Selflessness', 'Creativity'],
    shadows: ['Self-sacrifice', 'Idealism', 'Burnout', 'Difficulty with personal needs'],
    journalPrompt: 'How do you balance service to others with care for yourself? Where might you be giving from an empty cup?',
    keywords: ['Service', 'Compassion', 'Teaching', 'Healing'],
    color: 'bg-secondary',
  },
};

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide mb-1" style={{ color: 'hsl(var(--primary))' }}>
      {children}
    </p>
  );
}

function StepBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-xs font-mono"
      style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
      {children}
    </span>
  );
}

function NumberResultCard({ label, number, icon, steps }: {
  label: string; number: number; icon: string; steps?: React.ReactNode;
}) {
  const [showSteps, setShowSteps] = useState(false);
  // eslint-disable-next-line security/detect-object-injection
  const meaning = MEANINGS[number];
  if (!meaning) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-5 space-y-4"
      style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <SectionLabel>{label}</SectionLabel>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-bold font-serif" style={{ color: 'hsl(var(--primary))' }}>{number}</span>
            <span className="text-lg font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{icon} {meaning.archetype}</span>
          </div>
        </div>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{meaning.overview}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--accent))' }}>Strengths</p>
          <ul className="space-y-1">
            {meaning.strengths.map(s => (
              <li key={s} className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>✦ {s}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-medium mb-1.5" style={{ color: 'hsl(var(--accent-rose, var(--destructive)))' }}>Shadow themes</p>
          <ul className="space-y-1">
            {meaning.shadows.map(c => (
              <li key={c} className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>✦ {c}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="rounded-xl p-3 text-xs italic leading-relaxed"
        style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
        💭 <span className="font-medium not-italic">Reflection:</span> {meaning.journalPrompt}
      </div>
      {steps && (
        <div>
          <button
            onClick={() => setShowSteps(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: 'hsl(var(--primary))' }}
            aria-expanded={showSteps}>
            {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showSteps ? 'Hide' : 'Show'} calculation steps
          </button>
          <AnimatePresence>
            {showSteps && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="mt-2 pt-2 space-y-1.5" style={{ borderTop: '1px solid hsl(var(--border))' }}>
                  {steps}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}

function NumberLibraryCard({ num }: { num: number }) {
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line security/detect-object-injection
  const m = MEANINGS[num];
  if (!m) return null;
  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:opacity-80 transition-opacity"
        aria-expanded={open}>
        <span className="text-3xl font-bold font-serif w-10 text-center flex-shrink-0"
          style={{ color: 'hsl(var(--primary))' }}>{num}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'hsl(var(--foreground))' }}>{m.archetype}</p>
          <p className="text-xs truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {m.keywords.join(' · ')}
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
               : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-3" style={{ borderTop: '1px solid hsl(var(--border))' }}>
              <p className="text-sm leading-relaxed pt-3" style={{ color: 'hsl(var(--muted-foreground))' }}>{m.overview}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--accent))' }}>Strengths</p>
                  <ul className="space-y-0.5">{m.strengths.map(s => <li key={s} className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>✦ {s}</li>)}</ul>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--destructive))' }}>Shadow themes</p>
                  <ul className="space-y-0.5">{m.shadows.map(c => <li key={c} className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>✦ {c}</li>)}</ul>
                </div>
              </div>
              <div className="rounded-xl p-3 text-xs italic leading-relaxed"
                style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                💭 {m.journalPrompt}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function NumerologyPage() {
  const [calcTab, setCalcTab] = useState<'lifepath' | 'name' | 'full'>('lifepath');
  const [birthdate, setBirthdate] = useState('');
  const [fullName, setFullName] = useState('');
  const [lifePathResult, setLifePathResult] = useState<ReturnType<typeof calcLifePath>>(null);
  const [nameResult, setNameResult] = useState<ReturnType<typeof calcNameNumbers> | null>(null);
  const [personalYearResult, setPersonalYearResult] = useState<ReturnType<typeof calcPersonalYear>>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [hasCalculated, setHasCalculated] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [grimSaving, setGrimSaving] = useState(false);
  const [grimSaved, setGrimSaved] = useState(false);
  const [grimError, setGrimError] = useState<string | null>(null);
  const { data: session } = useSession();

  const currentYear = 2026; // from dynamic context: November 24, 2026

  function validate(): string | null {
    if (calcTab === 'lifepath' || calcTab === 'full') {
      if (!birthdate) return 'Please enter your birthdate.';
      const d = new Date(birthdate);
      if (isNaN(d.getTime())) return 'Please enter a valid date.';
      if (d.getFullYear() < 1900 || d > new Date()) return 'Please enter a date between 1900 and today.';
    }
    if (calcTab === 'name' || calcTab === 'full') {
      if (!fullName.trim()) return 'Please enter your full birth name.';
      if (fullName.trim().length < 2) return 'Please enter at least a first and last name.';
    }
    return null;
  }

  function calculate() {
    const err = validate();
    if (err) { setCalcError(err); return; }
    setCalcError(null);

    if (calcTab === 'lifepath' || calcTab === 'full') {
      setLifePathResult(calcLifePath(birthdate));
      setPersonalYearResult(calcPersonalYear(birthdate, currentYear));
    } else {
      setLifePathResult(null);
      setPersonalYearResult(null);
    }

    if (calcTab === 'name' || calcTab === 'full') {
      const [, , d] = birthdate.split('-').map(Number);
      setNameResult(calcNameNumbers(fullName, d || undefined));
    } else {
      setNameResult(null);
    }

    setHasCalculated(true);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function reset() {
    setHasCalculated(false);
    setLifePathResult(null);
    setNameResult(null);
    setPersonalYearResult(null);
    setCalcError(null);
    setGrimSaved(false);
    setGrimError(null);
  }

  async function saveToGrimoire() {
    if (!session?.user) return;
    setGrimSaving(true);
    setGrimError(null);
    try {
      const lines: string[] = [];
      if (lifePathResult && lifePathResult.result > 0) {
        lines.push('Life Path: ' + lifePathResult.result + ' (' + (MEANINGS[lifePathResult.result]?.archetype ?? '') + ')');
      }
      if (nameResult) {
        lines.push('Expression: ' + nameResult.expression);
        lines.push('Soul Urge: ' + nameResult.soulUrge);
        lines.push('Personality: ' + nameResult.personality);
        if (nameResult.birthday > 0) lines.push('Birthday: ' + nameResult.birthday);
      }
      if (personalYearResult) {
        lines.push('Personal Year ' + currentYear + ': ' + personalYearResult.result);
      }
      const modeLabel = calcTab === 'lifepath' ? 'Life Path' : calcTab === 'name' ? 'Name Numbers' : 'Full Reading';
      const res = await fetch('/api/grimoire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'numerology',
          title: modeLabel + ' Numerology Reading',
          content: lines.join('\n'),
          notes: '',
          tags: 'numerology,' + modeLabel.toLowerCase().replace(/\s/g, '-'),
          entryDate: new Date().toISOString().split('T')[0],
          metadata: {
            mode: calcTab,
            lifePathNumber: lifePathResult?.result ?? null,
            expressionNumber: nameResult?.expression ?? null,
            soulUrgeNumber: nameResult?.soulUrge ?? null,
            personalityNumber: nameResult?.personality ?? null,
            birthdayNumber: nameResult?.birthday ?? null,
            personalYearNumber: personalYearResult?.result ?? null,
            personalYear: currentYear,
            convention: 'Modern Pythagorean',
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setGrimSaved(true);
    } catch {
      setGrimError('Could not save to Grimoire. Please try again.');
    } finally {
      setGrimSaving(false);
    }
  }

  // Life Path steps JSX
  const lifePathSteps = lifePathResult ? (
    <div className="space-y-1 text-xs font-mono" style={{ color: 'hsl(var(--muted-foreground))' }}>
      <p>Month: {lifePathResult.month} → <StepBadge>{lifePathResult.monthReduced}</StepBadge></p>
      <p>Day: {lifePathResult.day} → <StepBadge>{lifePathResult.dayReduced}</StepBadge></p>
      <p>Year: {lifePathResult.year} → digit sum → <StepBadge>{lifePathResult.yearReduced}</StepBadge></p>
      <p>{lifePathResult.monthReduced} + {lifePathResult.dayReduced} + {lifePathResult.yearReduced} = {lifePathResult.total} → <StepBadge>{lifePathResult.result}</StepBadge></p>
      <p className="text-xs not-italic pt-1" style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
        Convention: Modern Pythagorean. Month, day, and year are reduced separately; master numbers 11, 22, 33 are preserved at each step.
      </p>
    </div>
  ) : null;

  // Name steps JSX
  function nameStepsJsx(label: string, filter: 'all' | 'vowels' | 'consonants', total: number, result: number) {
    if (!nameResult) return null;
    const filtered = nameResult.letters.filter(l =>
      filter === 'all' ? true : filter === 'vowels' ? l.isVowel : !l.isVowel
    );
    return (
      <div className="space-y-1 text-xs font-mono" style={{ color: 'hsl(var(--muted-foreground))' }}>
        <p className="font-medium not-italic">{label}</p>
        <div className="flex flex-wrap gap-1">
          {filtered.map((l, i) => (
            <span key={i} className="px-1.5 py-0.5 rounded text-xs"
              style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))' }}>
              {l.char.toUpperCase()}={l.value}
            </span>
          ))}
        </div>
        <p>Sum: {total} → <StepBadge>{result}</StepBadge></p>
        {nameResult.skippedChars.length > 0 && (
          <p className="text-xs not-italic" style={{ color: 'hsl(var(--warning, var(--primary)))' }}>
            ⚠ Unsupported characters skipped: {nameResult.skippedChars.join(', ')}. Only A–Z are mapped in this implementation.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Free Numerology Calculator & Number Meanings | Spellful</title>
        <meta name="description" content="Explore your Life Path, name numbers and personal cycles with Spellful's free numerology calculator, number meanings and beginner guides." />
        <meta property="og:title" content="Free Numerology Calculator & Number Meanings | Spellful" />
        <meta property="og:description" content="Explore your Life Path, name numbers and personal cycles with Spellful's free numerology calculator, number meanings and beginner guides." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://spellful.com/numerology" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Free Numerology Calculator & Number Meanings | Spellful" />
        <meta name="twitter:description" content="Explore your Life Path, name numbers and personal cycles with Spellful's free numerology calculator, number meanings and beginner guides." />
        <meta name="twitter:image" content="https://spellful.com/airo-assets/uploads/pages-og-image-7ff4c824.png" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <main id="main-content">
        {/* ── Hero ── */}
        <section className="py-16 px-4 text-center" aria-labelledby="numerology-heading">
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-4">
            <p className="text-sm font-medium" style={{ color: 'hsl(var(--primary))' }}>
              The Language of Numbers
            </p>
            <h1 id="numerology-heading" className="text-4xl md:text-5xl font-serif font-bold"
              style={{ color: 'hsl(var(--foreground))' }}>
              Your Life, Written in Numbers.
            </h1>
            <p className="text-base leading-relaxed max-w-lg mx-auto"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              Explore the symbolism of your birthdate and name, and discover a new perspective on your personal journey.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a href="#calculator"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <Sparkles className="w-4 h-4" /> Discover My Numbers
              </a>
              <a href="#history"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border transition-opacity hover:opacity-80"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
                <BookOpen className="w-4 h-4" /> Learn About Numerology
              </a>
            </div>
          </motion.div>
        </section>

        {/* ── Page nav ── */}
        <nav aria-label="Numerology page sections"
          className="sticky top-0 z-10 border-b px-4 overflow-x-auto"
          style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
          <div className="max-w-3xl mx-auto flex items-center gap-1 py-2 min-w-max">
            {[
              { href: '#calculator', label: 'Discover' },
              { href: '#number-library', label: 'Number Library' },
              { href: '#angel-numbers', label: 'Repeating Numbers' },
              { href: '#history', label: 'History' },
            ].map(({ href, label }) => (
              <a key={href} href={href}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors hover:opacity-80"
                style={{ color: 'hsl(var(--muted-foreground))' }}>
                {label}
              </a>
            ))}
          </div>
        </nav>

        {/* ── Calculator ── */}
        <section id="calculator" className="py-12 px-4" aria-labelledby="calculator-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="calculator-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>
                Numerology Calculator
              </h2>
            </div>

            <div className="rounded-2xl border p-6 space-y-6"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>

              {/* Calculation type selector */}
              <fieldset>
                <legend className="text-sm font-medium mb-3" style={{ color: 'hsl(var(--foreground))' }}>
                  Choose your reading
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {([
                    {
                      id: 'lifepath',
                      label: 'Life Path',
                      tagline: 'Birthdate only',
                      description: 'Explore symbolic themes associated with your birthdate. Reveals your Life Path and Personal Year numbers.',
                    },
                    {
                      id: 'name',
                      label: 'Name Numbers',
                      tagline: 'Birth name only',
                      description: 'Explore expression, inner motivations, and outward identity using your birth name.',
                    },
                    {
                      id: 'full',
                      label: 'Full Reading',
                      tagline: 'Both required',
                      description: 'Combine birthdate and name numbers into a complete personal profile.',
                    },
                  ] as const).map(({ id, label, tagline, description }) => (
                    <button key={id}
                      onClick={() => { setCalcTab(id); reset(); }}
                      className="rounded-xl border p-4 text-left transition-all"
                      style={{
                        background: calcTab === id ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                        borderColor: calcTab === id ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                      }}
                      aria-pressed={calcTab === id}>
                      <p className="font-semibold text-sm" style={{ color: calcTab === id ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>
                        {label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{tagline}</p>
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'hsl(var(--muted-foreground) / 0.8)' }}>{description}</p>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Inputs */}
              <div className="space-y-4">
                {(calcTab === 'lifepath' || calcTab === 'full') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="birthdate-input">Your Birthdate</Label>
                    <Input id="birthdate-input" type="date" value={birthdate}
                      onChange={e => { setBirthdate(e.target.value); reset(); }}
                      max={new Date().toISOString().split('T')[0]}
                      min="1900-01-01"
                      className="bg-background" />
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      Used to calculate your Life Path and Personal Year numbers.
                    </p>
                  </div>
                )}
                {(calcTab === 'name' || calcTab === 'full') && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullname-input">Your Full Birth Name</Label>
                    <Input id="fullname-input"
                      placeholder="e.g. Jane Marie Smith"
                      value={fullName}
                      onChange={e => { setFullName(e.target.value); reset(); }}
                      className="bg-background"
                      autoComplete="off" />
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                      Use the name on your birth certificate for Expression, Soul Urge, and Personality numbers.
                      Your name is not stored or transmitted — all calculations happen in your browser.
                    </p>
                  </div>
                )}
              </div>

              {calcError && (
                <p role="alert" className="text-sm rounded-xl px-4 py-2"
                  style={{ background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' }}>
                  {calcError}
                </p>
              )}

              <Button onClick={calculate} className="w-full" size="lg"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <Sparkles className="w-4 h-4 mr-2" />
                {hasCalculated ? 'Recalculate' : 'Discover My Numbers'}
              </Button>

              {/* Methodology note */}
              <div className="flex gap-2 rounded-xl p-3"
                style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                  This calculator uses the <strong>modern Pythagorean convention</strong>: letters A–Z mapped 1–9 cyclically,
                  master numbers 11, 22, and 33 preserved. Y is treated as a consonant.
                  Traditions vary — results may differ from other tools.
                </p>
              </div>
            </div>

            {/* Results */}
            <div ref={resultsRef}>
              <AnimatePresence>
                {hasCalculated && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

                    {/* Overview grid — quick-scan summary of all numbers */}
                    {(lifePathResult || nameResult) && (
                      <div className="rounded-2xl border p-4"
                        style={{ background: 'hsl(var(--primary) / 0.06)', borderColor: 'hsl(var(--primary) / 0.3)' }}>
                        <p className="text-sm font-semibold mb-3" style={{ color: 'hsl(var(--primary))' }}>
                          Your Numbers at a Glance
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {lifePathResult && lifePathResult.result > 0 && (
                            <div className="text-center">
                              <p className="text-3xl font-bold font-serif" style={{ color: 'hsl(var(--primary))' }}>{lifePathResult.result}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Life Path</p>
                            </div>
                          )}
                          {nameResult && (
                            <>
                              <div className="text-center">
                                <p className="text-3xl font-bold font-serif" style={{ color: 'hsl(var(--primary))' }}>{nameResult.expression}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Expression</p>
                              </div>
                              <div className="text-center">
                                <p className="text-3xl font-bold font-serif" style={{ color: 'hsl(var(--primary))' }}>{nameResult.soulUrge}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Soul Urge</p>
                              </div>
                              <div className="text-center">
                                <p className="text-3xl font-bold font-serif" style={{ color: 'hsl(var(--primary))' }}>{nameResult.personality}</p>
                                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Personality</p>
                              </div>
                              {nameResult.birthday > 0 && (
                                <div className="text-center">
                                  <p className="text-3xl font-bold font-serif" style={{ color: 'hsl(var(--primary))' }}>{nameResult.birthday}</p>
                                  <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Birthday</p>
                                </div>
                              )}
                            </>
                          )}
                          {personalYearResult && (
                            <div className="text-center">
                              <p className="text-3xl font-bold font-serif" style={{ color: 'hsl(var(--secondary))' }}>{personalYearResult.result}</p>
                              <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>Personal Year</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {lifePathResult && lifePathResult.result > 0 && (
                      <NumberResultCard
                        label="Life Path Number"
                        number={lifePathResult.result}
                        icon="🌙"
                        steps={lifePathSteps}
                      />
                    )}
                    {nameResult && (
                      <>
                        <NumberResultCard
                          label="Expression / Destiny Number"
                          number={nameResult.expression}
                          icon="⭐"
                          steps={nameStepsJsx('All letters (A–Z)', 'all', nameResult.expressionTotal, nameResult.expression)}
                        />
                        <NumberResultCard
                          label="Soul Urge Number"
                          number={nameResult.soulUrge}
                          icon="🔮"
                          steps={nameStepsJsx('Vowels only (A, E, I, O, U)', 'vowels', nameResult.soulTotal, nameResult.soulUrge)}
                        />
                        <NumberResultCard
                          label="Personality Number"
                          number={nameResult.personality}
                          icon="✨"
                          steps={nameStepsJsx('Consonants only', 'consonants', nameResult.personalityTotal, nameResult.personality)}
                        />
                        {nameResult.birthday > 0 && (
                          <NumberResultCard
                            label="Birthday Number"
                            number={nameResult.birthday}
                            icon="🎂"
                          />
                        )}
                      </>
                    )}
                    {personalYearResult && (
                      <NumberResultCard
                        label={'Personal Year ' + currentYear}
                        number={personalYearResult.result}
                        icon="🗓"
                        steps={
                          <div className="space-y-1 text-xs font-mono" style={{ color: 'hsl(var(--muted-foreground))' }}>
                            <p>Birth month + birth day + {currentYear} = {personalYearResult.total} → <StepBadge>{personalYearResult.result}</StepBadge></p>
                            <p className="text-xs not-italic pt-1" style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
                              Personal Year is a contemporary numerology concept; interpretations vary by practitioner.
                            </p>
                          </div>
                        }
                      />
                    )}

                    {/* Post-results actions */}
                    {(lifePathResult || nameResult) && (
                      <div className="space-y-2 pt-2">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline" size="sm"
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                            ✏️ Edit Details
                          </Button>
                          {session?.user ? (
                            <Button
                              onClick={() => void saveToGrimoire()}
                              disabled={grimSaving || grimSaved}
                              variant="outline" size="sm"
                              style={{
                                borderColor: grimSaved ? 'hsl(var(--success))' : 'hsl(var(--accent) / 0.5)',
                                color: grimSaved ? 'hsl(var(--success))' : 'hsl(var(--accent))',
                              }}>
                              <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                              {grimSaved ? 'Saved to Grimoire' : grimSaving ? 'Saving...' : 'Save to Grimoire'}
                            </Button>
                          ) : (
                            <a href="/login"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-opacity hover:opacity-80"
                              style={{ borderColor: 'hsl(var(--accent) / 0.5)', color: 'hsl(var(--accent))' }}>
                              <BookOpen className="w-3.5 h-3.5" /> Sign in to Save
                            </a>
                          )}
                          <a href="#number-library"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-opacity hover:opacity-80"
                            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                            <BookOpen className="w-3.5 h-3.5" /> Explore My Numbers
                          </a>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => { reset(); setBirthdate(''); setFullName(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Start New Reading
                          </Button>
                        </div>
                        {grimError && (
                          <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>{grimError}</p>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ── Number Library ── */}
        <section id="number-library" className="py-12 px-4" aria-labelledby="library-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="library-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>
                Number Library
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Profiles for numbers 1–9 and the master numbers 11, 22, and 33 as used in modern Pythagorean numerology.
              These are contemporary interpretive frameworks, not ancient classifications.
              Tap any number to expand its profile.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>Core numbers</p>
              {[1,2,3,4,5,6,7,8,9].map(n => <NumberLibraryCard key={n} num={n} />)}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Master numbers — recognized in many modern schools; conventions vary
              </p>
              {[11,22,33].map(n => <NumberLibraryCard key={n} num={n} />)}
            </div>
          </div>
        </section>

        {/* ── Angel / Repeating Numbers ── */}
        <section id="angel-numbers" className="py-12 px-4" aria-labelledby="angel-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="angel-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>
                Repeating Numbers
              </h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
              Noticing repeating number patterns — 111, 444, 1111 — is a normal feature of human pattern recognition.
              The practice of assigning spiritual meaning to these sequences is a <strong>contemporary</strong> one,
              popularized in the late twentieth century. The interpretations below are modern spiritual conventions,
              not documented ancient teachings. Use them as journaling prompts if they resonate with you.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {numerology.ANGEL_NUMBERS.map(({ n, title, body }) => (
                <div key={n} className="rounded-2xl border p-4 space-y-2"
                  style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold font-serif" style={{ color: 'hsl(var(--primary))' }}>{n}</span>
                    <span className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>{title}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── History & Traditions ── */}
        <section id="history" className="py-12 px-4" aria-labelledby="history-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="history-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>
                History &amp; Traditions
              </h2>
            </div>

            <div className="rounded-2xl border p-5 text-sm leading-relaxed space-y-4"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
              <p>
                Numbers have carried symbolic meaning across many cultures for centuries. Ancient philosophers explored
                relationships between number, harmony, and the natural world, while religious and literary traditions
                developed their own ways of interpreting numerical patterns. Modern numerology draws inspiration from
                some of these ideas, using names and birthdates as prompts for spiritual reflection. It is a symbolic
                practice, rather than a scientifically validated way to predict events or determine personality.
              </p>

              <div className="space-y-4 pt-2">
                {[
                  {
                    period: 'Ancient world',
                    body: 'Diverse cultures assigned symbolic significance to numbers independently of one another. Babylonian, Egyptian, Chinese, and Indian traditions each developed their own numerical frameworks within their own religious and philosophical contexts. These should be understood on their own terms rather than as a single unified system.',
                  },
                  {
                    period: 'Sixth century BCE onward — Pythagorean philosophy',
                    body: 'The Greek philosopher Pythagoras and his followers explored the relationship between number, harmony, and the structure of the cosmos. Later Pythagorean traditions developed rich philosophical frameworks around number symbolism. It is important to distinguish Pythagoras himself from the many centuries of followers who elaborated his ideas — and to note that modern name-number calculations are not documented in ancient Pythagorean texts.',
                  },
                  {
                    period: 'Classical and later antiquity',
                    body: 'Greek isopsephy — the practice of assigning numerical values to letters — was used in literary, religious, and philosophical contexts. Similar practices appeared in other Mediterranean cultures. These were distinct from modern personal numerology and operated within their own cultural frameworks.',
                  },
                  {
                    period: 'Jewish traditions — Gematria',
                    body: 'Gematria is a method of interpreting Hebrew scripture by assigning numerical values to letters. It has a long history within Jewish textual and religious tradition. It should not be equated with modern Western name numerology, which uses a different alphabet, different letter values, and different interpretive goals.',
                  },
                  {
                    period: 'Medieval and Renaissance periods',
                    body: 'Number symbolism was transmitted and reinterpreted through philosophical, religious, and esoteric writings across Europe and the Islamic world. Scholars engaged with Pythagorean, Neoplatonic, and Kabbalistic ideas in ways that shaped later Western esotericism.',
                  },
                  {
                    period: 'Late nineteenth and early twentieth centuries — modern numerology',
                    body: 'The form of personal numerology most widely practiced today — using birthdates and names to generate individual readings — was developed primarily in this period. Writers such as L. Dow Balliett (1857–1929) are credited with systematizing the modern Pythagorean approach. The so-called "Chaldean" method, also used today, is a distinct convention; claims that it directly preserves ancient Babylonian algorithms are not well-supported by historical evidence.',
                  },
                  {
                    period: 'Present day',
                    body: 'Contemporary numerology encompasses a wide range of practices, from personal chart readings and life-path analysis to the popular culture of angel numbers and daily number reflections. It is practiced as a form of spiritual self-inquiry and journaling rather than as a predictive science.',
                  },
                ].map(({ period, body }) => (
                  <div key={period} className="pl-4" style={{ borderLeft: '2px solid hsl(var(--primary) / 0.4)' }}>
                    <p className="font-semibold text-sm mb-1" style={{ color: 'hsl(var(--foreground))' }}>{period}</p>
                    <p className="text-sm leading-relaxed">{body}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl p-4 mt-4"
                style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--foreground))' }}>A note on sources</p>
                <p className="text-xs leading-relaxed">
                  The history above is a general orientation, not a scholarly bibliography. Dates and attributions
                  in popular numerology writing are sometimes inaccurate. For deeper reading, consult primary texts
                  and peer-reviewed histories of Western esotericism. Spellful presents numerology as a reflective
                  practice and does not claim scientific validity for its interpretations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom spacer ── */}
        <div className="h-16" />
      </main>
    </>
  );
}
