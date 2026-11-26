/**
 * /runes — Spellful Runes Discovery Center
 *
 * Redesign per Spellful_Runes_Improvement_Plan.txt:
 * - Hero with eyebrow, headline, anchor CTAs
 * - Sticky page nav (Cast · History · Library · How to Read · Rune Magic)
 * - Cast Runes: three named spreads, optional intention field, cast animation,
 *   individual reveals, reading summary
 * - History & Mythology: substantial article + interactive timeline
 * - Rune Library: all 24 Elder Futhark in three aettir, expandable profiles
 * - How to Read Runes: beginner guide
 * - Rune Magic: contemporary practice articles
 *
 * Historical accuracy notes:
 * - Rune names are reconstructed; directly attested names come from later sources
 * - Elder Futhark predates the Viking Age; Vikings used Younger Futhark (16 chars)
 * - Modern spreads (1/3/5 rune) are contemporary, not historically documented
 * - Reversals are a modern convention, not a universal or ancient requirement
 * - The blank rune is NOT part of the historical Elder Futhark alphabet
 * - Bindrune magical use: historical evidence exists; many modern designs are new
 */

import { useState, useRef, useCallback } from 'react';
import { useSession } from '@/lib/auth/auth-client';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Sparkles, ChevronDown, ChevronUp, Info, Search } from 'lucide-react';
import { runes } from 'virtual:content';

// ─── Elder Futhark data ────────────────────────────────────────────────────

interface RuneData {
  symbol: string;
  name: string;
  altSpellings: string;
  position: string; // e.g. "1st Aett · 1 of 8"
  phonetic: string;
  historicalMeaning: string;
  modernMeaning: string;
  shadow: string;
  modernMagic: string;
  keywords: string[];
  reflectionQ: string;
  journalPrompt: string;
  noReversed?: boolean;
}

const FIRST_AETT: RuneData[] = [
  {
    symbol: 'ᚠ', name: 'Fehu', altSpellings: 'Feoh, Fe',
    position: 'First Aett · 1 of 8', phonetic: '/f/',
    historicalMeaning: 'Cattle, livestock, and movable wealth. In the runic poems, Fehu is associated with strife among kinsmen and the responsibilities that come with wealth.',
    modernMeaning: 'Abundance, prosperity, opportunity, and the responsible stewardship of resources. Often interpreted as a prompt to reflect on what you have and how you use it.',
    shadow: 'Attachment to possessions, scarcity thinking, greed, or mismanagement of resources.',
    modernMagic: 'Used in contemporary practice for abundance intentions and prosperity work. Clearly a modern association.',
    keywords: ['Wealth', 'Abundance', 'Resources', 'Stewardship'],
    reflectionQ: 'What does true abundance mean to you beyond material wealth?',
    journalPrompt: 'Identify a resource in your life — time, skill, relationship, or material — that you appreciate, and one way you could use it more responsibly or generously.',
  },
  {
    symbol: 'ᚢ', name: 'Uruz', altSpellings: 'Ur, Uraz',
    position: 'First Aett · 2 of 8', phonetic: '/u/',
    historicalMeaning: 'Aurochs (wild ox), the now-extinct large bovine of northern Europe. The runic poems associate it with strength, hardship, and the untamed.',
    modernMeaning: 'Primal strength, vitality, endurance, and the courage to face challenges. Often interpreted as a call to connect with your inner resilience.',
    shadow: 'Weakness, missed opportunities, lack of motivation, or force misdirected.',
    modernMagic: 'Associated in contemporary practice with health, physical vitality, and strength work.',
    keywords: ['Strength', 'Vitality', 'Endurance', 'Courage'],
    reflectionQ: 'Where in your life are you being called to draw on your deepest reserves of strength?',
    journalPrompt: 'Describe a challenge you have faced that required more endurance than you thought you had. What did you discover about yourself?',
  },
  {
    symbol: 'ᚦ', name: 'Thurisaz', altSpellings: 'Thorn, Thurs',
    position: 'First Aett · 3 of 8', phonetic: '/θ/ (as in "thorn")',
    historicalMeaning: 'Thorn, or giant (þurs in Old Norse). Associated with the jötnar (giants) of Norse mythology and with the protective, dangerous quality of thorns.',
    modernMeaning: 'Protection, boundaries, directed force, and the power to overcome obstacles. Also interpreted as a warning to pause before acting.',
    shadow: 'Danger, compulsion, aggression, or vulnerability when boundaries are absent.',
    modernMagic: 'Used in contemporary protective work and boundary-setting intentions.',
    keywords: ['Protection', 'Boundaries', 'Force', 'Threshold'],
    reflectionQ: 'Where do you need to set a clearer boundary, and what makes that difficult?',
    journalPrompt: 'Write about a situation where you held a boundary that was hard to maintain. What supported you?',
  },
  {
    symbol: 'ᚨ', name: 'Ansuz', altSpellings: 'As, Os',
    position: 'First Aett · 4 of 8', phonetic: '/a/',
    historicalMeaning: 'A god (áss in Old Norse), associated with Odin in the Norse tradition. The runic poems connect it with wisdom, speech, and divine communication.',
    modernMeaning: 'Communication, wisdom, inspiration, and the power of words. Often interpreted as a prompt to pay attention to messages, signs, or your own inner voice.',
    shadow: 'Deception, miscommunication, blocked inspiration, or words used harmfully.',
    modernMagic: 'Associated in contemporary practice with communication, writing, and seeking wisdom.',
    keywords: ['Communication', 'Wisdom', 'Inspiration', 'Voice'],
    reflectionQ: 'What message have you been receiving but not fully listening to?',
    journalPrompt: 'Write freely for five minutes about something you have been wanting to say but have held back. What is stopping you?',
  },
  {
    symbol: 'ᚱ', name: 'Raidho', altSpellings: 'Rad, Reid',
    position: 'First Aett · 5 of 8', phonetic: '/r/',
    historicalMeaning: 'Riding, journey, or the wheel. The runic poems associate it with travel and the rhythm of movement.',
    modernMeaning: 'Journey, movement, right action, and finding your path. Often interpreted as a prompt to reflect on direction and the quality of your movement through life.',
    shadow: 'Disruption, crisis, being off your true path, or movement without purpose.',
    modernMagic: 'Used in contemporary practice for travel protection and guidance on direction.',
    keywords: ['Journey', 'Direction', 'Rhythm', 'Right action'],
    reflectionQ: 'Are you moving toward something meaningful, or moving to avoid something?',
    journalPrompt: 'Describe where you are in a journey that matters to you — not necessarily physical. What is the next step?',
  },
  {
    symbol: 'ᚲ', name: 'Kenaz', altSpellings: 'Kaunan, Ken, Cen',
    position: 'First Aett · 6 of 8', phonetic: '/k/',
    historicalMeaning: 'Torch or ulcer (the runic poems differ). The torch interpretation connects it with light, knowledge, and craft; the ulcer interpretation with pain and transformation.',
    modernMeaning: 'Creative fire, knowledge, illumination, and the transformative power of inner light. Often interpreted as a call to engage with your creative or intellectual gifts.',
    shadow: 'Loss of direction, false hope, creative blocks, or knowledge used destructively.',
    modernMagic: 'Associated in contemporary practice with creativity, learning, and illumination work.',
    keywords: ['Creativity', 'Knowledge', 'Illumination', 'Craft'],
    reflectionQ: 'What creative or intellectual fire is waiting to be lit in your life?',
    journalPrompt: 'Describe a skill or area of knowledge you have been wanting to develop. What one small step could you take this week?',
  },
  {
    symbol: 'ᚷ', name: 'Gebo', altSpellings: 'Gyfu, Gifu',
    position: 'First Aett · 7 of 8', phonetic: '/g/',
    historicalMeaning: 'Gift or generosity. The runic poems associate it with honor, the obligations of gift exchange, and the social bonds created by giving and receiving.',
    modernMeaning: 'Gifts, partnerships, balance, and the sacred exchange of giving and receiving. Often interpreted as a prompt to reflect on reciprocity in your relationships.',
    shadow: 'Imbalance in giving and receiving, obligation, or gifts given with strings attached.',
    modernMagic: 'Associated in contemporary practice with partnership work and balanced exchange.',
    keywords: ['Gift', 'Partnership', 'Balance', 'Reciprocity'],
    reflectionQ: 'Where in your life is the balance of giving and receiving out of alignment?',
    journalPrompt: 'Reflect on a relationship where you feel the exchange is unequal. What would a more balanced dynamic look like?',
    noReversed: true,
  },
  {
    symbol: 'ᚹ', name: 'Wunjo', altSpellings: 'Wynn, Wyn',
    position: 'First Aett · 8 of 8', phonetic: '/w/',
    historicalMeaning: 'Joy, pleasure, or kinship. The runic poems associate it with happiness, belonging, and the satisfaction of being in harmony with one\'s community.',
    modernMeaning: 'Joy, harmony, fulfillment, and the deep satisfaction of being in alignment with yourself and others. Often interpreted as a sign of wishes coming to fruition.',
    shadow: 'Sorrow, alienation, delayed success, or joy that comes at others\' expense.',
    modernMagic: 'Associated in contemporary practice with joy work, harmony intentions, and community.',
    keywords: ['Joy', 'Harmony', 'Fulfillment', 'Belonging'],
    reflectionQ: 'When did you last feel genuinely at ease and in harmony? What made that possible?',
    journalPrompt: 'Describe a moment of simple, uncomplicated joy from your recent life. What conditions supported it?',
  },
];

const SECOND_AETT: RuneData[] = [
  {
    symbol: 'ᚺ', name: 'Hagalaz', altSpellings: 'Hagall, Haegl',
    position: 'Second Aett · 1 of 8', phonetic: '/h/',
    historicalMeaning: 'Hail. The runic poems describe hail as a cold grain that melts into water — a force of disruption that also nourishes.',
    modernMeaning: 'Sudden change, disruption, and the clearing of what no longer serves. Often interpreted as a reminder that transformation sometimes arrives uninvited.',
    shadow: 'Unavoidable disruption, loss, or forces beyond your control.',
    modernMagic: 'Associated in contemporary practice with clearing and transformation work.',
    keywords: ['Change', 'Disruption', 'Transformation', 'Release'],
    reflectionQ: 'What disruption in your life might be clearing space for something new?',
    journalPrompt: 'Describe something that was disrupted or lost that, in hindsight, made room for growth. What did you learn?',
    noReversed: true,
  },
  {
    symbol: 'ᚾ', name: 'Nauthiz', altSpellings: 'Naudiz, Nyd',
    position: 'Second Aett · 2 of 8', phonetic: '/n/',
    historicalMeaning: 'Need or necessity. The runic poems describe it as grief and constraint, but also as the source of strength that comes from enduring hardship.',
    modernMeaning: 'Constraint, necessity, and the lessons found in hardship. Often interpreted as a prompt to examine what you truly need versus what you merely want.',
    shadow: 'Being trapped by your own needs, deprivation, or resistance to necessary change.',
    modernMagic: 'Associated in contemporary practice with identifying needs and working through constraint.',
    keywords: ['Need', 'Constraint', 'Endurance', 'Necessity'],
    reflectionQ: 'What do you genuinely need right now that you have been denying yourself?',
    journalPrompt: 'Identify one constraint in your life. Write about what it is teaching you and what it might be asking you to release.',
  },
  {
    symbol: 'ᛁ', name: 'Isa', altSpellings: 'Is, Iss',
    position: 'Second Aett · 3 of 8', phonetic: '/i/',
    historicalMeaning: 'Ice. The runic poems describe it as cold, slippery, and beautiful — a force that halts movement and demands stillness.',
    modernMeaning: 'Stillness, pause, introspection, and the wisdom of waiting. Often interpreted as a call to stop, look inward, and allow clarity to emerge.',
    shadow: 'Stagnation, isolation, or being frozen in place by fear or indecision.',
    modernMagic: 'Associated in contemporary practice with stillness work and clarity meditation.',
    keywords: ['Stillness', 'Pause', 'Clarity', 'Introspection'],
    reflectionQ: 'What would become clear if you allowed yourself to be completely still?',
    journalPrompt: 'Describe what happens in your mind and body when you stop moving and sit in silence. What arises?',
    noReversed: true,
  },
  {
    symbol: 'ᛃ', name: 'Jera', altSpellings: 'Ger, Ar',
    position: 'Second Aett · 4 of 8', phonetic: '/j/ (as in "year")',
    historicalMeaning: 'Year or harvest. The runic poems describe it as the reward of patient effort — the cycle of seasons and the fruits of labor.',
    modernMeaning: 'Natural cycles, the rewards of patient effort, and trust in the process. Often interpreted as a reminder that things unfold in their own time.',
    shadow: 'Impatience, forcing outcomes before their time, or failing to recognize what has already been harvested.',
    modernMagic: 'Associated in contemporary practice with harvest intentions and cyclical work.',
    keywords: ['Harvest', 'Cycles', 'Patience', 'Reward'],
    reflectionQ: 'What have you been tending that is ready to be acknowledged or harvested?',
    journalPrompt: 'Reflect on something you have worked toward patiently. What has grown, even if it is not yet fully visible?',
    noReversed: true,
  },
  {
    symbol: 'ᛇ', name: 'Eihwaz', altSpellings: 'Eoh, Ihwaz',
    position: 'Second Aett · 5 of 8', phonetic: '/eo/ or /æ/ (reconstructed)',
    historicalMeaning: 'Yew tree. The yew is associated with longevity, death, and rebirth across many northern European traditions. Its wood was used for bows and its berries are poisonous.',
    modernMeaning: 'Endurance, resilience, transformation, and the ability to navigate between states of being. Often interpreted as a symbol of deep roots and long vision.',
    shadow: 'Confusion, instability, or difficulty navigating a major transition.',
    modernMagic: 'Associated in contemporary practice with protection, endurance, and ancestral connection.',
    keywords: ['Endurance', 'Resilience', 'Transformation', 'Depth'],
    reflectionQ: 'What deep roots are supporting you through a current challenge?',
    journalPrompt: 'Describe a transformation you are in the middle of. What is the hardest part, and what is sustaining you?',
  },
  {
    symbol: 'ᛈ', name: 'Perthro', altSpellings: 'Peorth, Perth',
    position: 'Second Aett · 6 of 8', phonetic: '/p/',
    historicalMeaning: 'The historical meaning of Perthro is genuinely uncertain — it is one of the most debated runes among scholars. Possible interpretations include a dice cup, a fruit tree, or a gaming piece.',
    modernMeaning: 'Mystery, fate, hidden forces, and the unknown. Often interpreted as an invitation to sit with uncertainty and trust what cannot yet be seen.',
    shadow: 'Stagnation, addiction, or hidden forces working against you.',
    modernMagic: 'Associated in contemporary practice with divination, mystery, and working with the unknown.',
    keywords: ['Mystery', 'Fate', 'The unknown', 'Hidden forces'],
    reflectionQ: 'What are you trying to control that might be asking you to simply trust?',
    journalPrompt: 'Write about something in your life that remains genuinely uncertain. How do you relate to not knowing?',
  },
  {
    symbol: 'ᛉ', name: 'Algiz', altSpellings: 'Elhaz, Eolh',
    position: 'Second Aett · 7 of 8', phonetic: '/z/ or /R/ (reconstructed)',
    historicalMeaning: 'Possibly elk-sedge (a sharp-edged marsh grass) or elk. The runic poems describe it as dangerous to grasp — protective through its very nature.',
    modernMeaning: 'Protection, higher connection, sanctuary, and instinct. Often interpreted as a call to trust your protective instincts and your connection to something larger than yourself.',
    shadow: 'Vulnerability, hidden danger, or loss of protection through ignoring instinct.',
    modernMagic: 'Widely used in contemporary protective work and spiritual shielding.',
    keywords: ['Protection', 'Sanctuary', 'Instinct', 'Higher connection'],
    reflectionQ: 'What is your intuition protecting you from right now?',
    journalPrompt: 'Describe a time when you trusted your instincts and it served you well. What did that feel like?',
  },
  {
    symbol: 'ᛊ', name: 'Sowilo', altSpellings: 'Sigel, Sol',
    position: 'Second Aett · 8 of 8', phonetic: '/s/',
    historicalMeaning: 'Sun. The runic poems celebrate the sun as a guide for seafarers and a source of life and hope.',
    modernMeaning: 'Success, vitality, wholeness, and the illuminating power of clarity. Often interpreted as a sign of alignment and forward momentum.',
    shadow: 'Overconfidence, burnout from relentless striving, or clarity that reveals uncomfortable truths.',
    modernMagic: 'Associated in contemporary practice with success work, vitality, and solar energy.',
    keywords: ['Success', 'Vitality', 'Clarity', 'Wholeness'],
    reflectionQ: 'Where in your life do you feel most fully alive and in your power?',
    journalPrompt: 'Describe a recent success, however small. What did you do to make it possible?',
    noReversed: true,
  },
];

const THIRD_AETT: RuneData[] = [
  {
    symbol: 'ᛏ', name: 'Tiwaz', altSpellings: 'Tyr, Tir',
    position: 'Third Aett · 1 of 8', phonetic: '/t/',
    historicalMeaning: 'Tyr, the Norse god of justice and law. The myth of Tyr sacrificing his hand to bind the wolf Fenrir is associated with this rune — justice achieved through sacrifice.',
    modernMeaning: 'Justice, courage, sacrifice, and the willingness to stand for what is right even at personal cost. Often interpreted as a call to act with integrity.',
    shadow: 'Injustice, defeat, loss of faith in your cause, or sacrifice that is not truly chosen.',
    modernMagic: 'Associated in contemporary practice with justice work, courage, and legal matters.',
    keywords: ['Justice', 'Courage', 'Sacrifice', 'Integrity'],
    reflectionQ: 'Where are you being called to act with integrity, even when it is costly?',
    journalPrompt: 'Describe a situation where you chose what was right over what was easy. What did that cost you, and what did it give you?',
  },
  {
    symbol: 'ᛒ', name: 'Berkano', altSpellings: 'Beorc, Bjarkan',
    position: 'Third Aett · 2 of 8', phonetic: '/b/',
    historicalMeaning: 'Birch tree or birch twig. The runic poems associate it with new growth, the birch\'s early leafing in spring, and nurturing energy.',
    modernMeaning: 'New beginnings, growth, nurturing, and the gentle energy that supports what is just emerging. Often interpreted as a call to tend something new with care.',
    shadow: 'Stagnation, family troubles, blocked growth, or nurturing that becomes smothering.',
    modernMagic: 'Associated in contemporary practice with new beginnings, fertility, and nurturing work.',
    keywords: ['New beginnings', 'Growth', 'Nurturing', 'Emergence'],
    reflectionQ: 'What new beginning in your life needs gentle tending rather than forcing?',
    journalPrompt: 'Describe something new that is just beginning to emerge in your life. What does it need from you to grow?',
  },
  {
    symbol: 'ᛖ', name: 'Ehwaz', altSpellings: 'Eoh, Eh',
    position: 'Third Aett · 3 of 8', phonetic: '/e/',
    historicalMeaning: 'Horse. The horse was central to Germanic culture — a symbol of status, travel, and the bond between rider and animal.',
    modernMeaning: 'Partnership, trust, cooperation, and moving forward together. Often interpreted as a call to reflect on the quality of your collaborations and the trust within them.',
    shadow: 'Restlessness, betrayal, or movement in the wrong direction through misaligned partnership.',
    modernMagic: 'Associated in contemporary practice with partnership work and travel.',
    keywords: ['Partnership', 'Trust', 'Cooperation', 'Progress'],
    reflectionQ: 'Where in your life do you need to trust a partner or collaborator more fully?',
    journalPrompt: 'Describe a partnership — personal or professional — that is working well. What makes it function?',
  },
  {
    symbol: 'ᛗ', name: 'Mannaz', altSpellings: 'Man, Madr',
    position: 'Third Aett · 4 of 8', phonetic: '/m/',
    historicalMeaning: 'Human being or humanity. The runic poems reflect on the transience of human life and the importance of community and kinship.',
    modernMeaning: 'Self-awareness, humanity, community, and our shared nature. Often interpreted as a call to reflect on your place within the larger human story.',
    shadow: 'Isolation, self-deception, conflict with others, or losing yourself in the collective.',
    modernMagic: 'Associated in contemporary practice with self-knowledge and community work.',
    keywords: ['Self', 'Humanity', 'Community', 'Awareness'],
    reflectionQ: 'How do you balance your individual needs with your responsibilities to others?',
    journalPrompt: 'Reflect on your place in a community that matters to you. What do you contribute, and what do you receive?',
  },
  {
    symbol: 'ᛚ', name: 'Laguz', altSpellings: 'Lagu, Laukaz',
    position: 'Third Aett · 5 of 8', phonetic: '/l/',
    historicalMeaning: 'Water, lake, or leek (the runic poems differ). The water interpretation connects it with the sea, flow, and the unconscious depths.',
    modernMeaning: 'Intuition, flow, emotions, and the deep currents that shape our lives beneath the surface. Often interpreted as a call to trust your emotional intelligence.',
    shadow: 'Fear, confusion, being overwhelmed by emotions, or losing yourself in the current.',
    modernMagic: 'Associated in contemporary practice with intuition work, emotional healing, and water magic.',
    keywords: ['Intuition', 'Flow', 'Emotions', 'Depth'],
    reflectionQ: 'What emotional current are you swimming against rather than flowing with?',
    journalPrompt: 'Describe an emotion you have been avoiding. What would it feel like to simply let it flow through you?',
  },
  {
    symbol: 'ᛜ', name: 'Ingwaz', altSpellings: 'Ing, Inguz',
    position: 'Third Aett · 6 of 8', phonetic: '/ŋ/ (as in "sing")',
    historicalMeaning: 'Ing, a name associated with the god Freyr in some traditions. The runic poems describe a hero departing eastward — a figure of fertility and completion.',
    modernMeaning: 'Inner work, gestation, completion, and the gathering of strength before emergence. Often interpreted as a call to honor the work happening beneath the surface.',
    shadow: 'Stagnation, refusing to complete what has been started, or inner work avoided.',
    modernMagic: 'Associated in contemporary practice with inner work, fertility, and completion rituals.',
    keywords: ['Inner work', 'Gestation', 'Completion', 'Potential'],
    reflectionQ: 'What inner work have you been doing that is almost ready to emerge?',
    journalPrompt: 'Describe something you have been quietly developing within yourself. How will you know when it is ready?',
    noReversed: true,
  },
  {
    symbol: 'ᛞ', name: 'Dagaz', altSpellings: 'Daeg, Dag',
    position: 'Third Aett · 7 of 8', phonetic: '/d/',
    historicalMeaning: 'Day or dawn. The runic poems celebrate the day as a gift from the divine — light, hope, and the turning point between darkness and brightness.',
    modernMeaning: 'Breakthrough, awakening, clarity after darkness, and the transformative power of a new beginning. Often interpreted as a sign of a significant turning point.',
    shadow: 'Blinding yourself with false optimism, or a breakthrough that reveals something difficult.',
    modernMagic: 'Associated in contemporary practice with breakthrough work and new beginnings.',
    keywords: ['Breakthrough', 'Awakening', 'Clarity', 'Dawn'],
    reflectionQ: 'What breakthrough have you been approaching that you are almost ready to step through?',
    journalPrompt: 'Describe a moment when darkness gave way to clarity in your life. What made that shift possible?',
    noReversed: true,
  },
  {
    symbol: 'ᛟ', name: 'Othala', altSpellings: 'Odal, Ethel',
    position: 'Third Aett · 8 of 8', phonetic: '/o/',
    historicalMeaning: 'Ancestral estate or inherited land. The runic poems associate it with home, heritage, and the wealth that cannot be sold — the inheritance of kin and place.',
    modernMeaning: 'Heritage, ancestors, home, and the wisdom passed down through lineage. Often interpreted as a call to reflect on what you have inherited — both gifts and wounds.',
    shadow: 'Homelessness, loss of heritage, ancestral trauma, or clinging to the past.',
    modernMagic: 'Associated in contemporary practice with ancestral work and home protection.',
    keywords: ['Heritage', 'Ancestors', 'Home', 'Inheritance'],
    reflectionQ: 'What have you inherited from your ancestors — in gifts, in wounds, or in wisdom?',
    journalPrompt: 'Reflect on something you received from your family or lineage that you are grateful for, and something you are working to transform.',
  },
];

const ALL_RUNES = [...FIRST_AETT, ...SECOND_AETT, ...THIRD_AETT];

// ─── Spread definitions ────────────────────────────────────────────────────

type SpreadId = 'daily' | 'path' | 'wisdom';
interface Spread {
  id: SpreadId;
  name: string;
  count: 1 | 3 | 5;
  tagline: string;
  positions: string[];
  description: string;
}

const SPREADS: Spread[] = [
  {
    id: 'daily', name: 'Daily Guidance', count: 1,
    tagline: 'One rune · One reflection',
    positions: ['Your message for today'],
    description: 'Draw a single rune as a focal point for your day or a specific question.',
  },
  {
    id: 'path', name: 'Path & Clarity', count: 3,
    tagline: 'Three runes · Past, present, future',
    positions: ['What has shaped this', 'Where you are now', 'What is emerging'],
    description: 'Three runes as reflective perspectives on a situation or question.',
  },
  {
    id: 'wisdom', name: 'Deeper Wisdom', count: 5,
    tagline: 'Five runes · A fuller picture',
    positions: ['The situation', 'The challenge', 'Guidance', 'What to act on', 'Potential outcome'],
    description: 'Five runes for a more layered exploration of a complex situation.',
  },
];

// ─── Utility ───────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // eslint-disable-next-line security/detect-object-injection
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium tracking-wide mb-1" style={{ color: 'hsl(var(--primary))' }}>
      {children}
    </p>
  );
}

function RuneStone({ symbol, size = 'md', reversed = false, faceDown = false, onClick }: {
  symbol: string; size?: 'sm' | 'md' | 'lg'; reversed?: boolean; faceDown?: boolean; onClick?: () => void;
}) {
  const sizes = { sm: 'w-10 h-10 text-xl', md: 'w-16 h-16 text-3xl', lg: 'w-20 h-20 text-4xl' };
  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick(); } : undefined}
      className={`${sizes[size]} rounded-xl flex items-center justify-center flex-shrink-0 transition-all select-none
        ${onClick ? 'cursor-pointer hover:scale-105 active:scale-95' : ''}`}
      style={{
        background: faceDown
          ? 'hsl(var(--muted))'
          : 'linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--muted)) 100%)',
        border: '1px solid hsl(var(--border))',
        boxShadow: '0 2px 8px hsl(var(--background) / 0.6)',
        transform: reversed ? 'rotate(180deg)' : undefined,
      }}>
      {faceDown
        ? <span style={{ color: 'hsl(var(--muted-foreground) / 0.4)', fontSize: '1.5rem' }}>ᚠ</span>
        : <span style={{ color: 'hsl(var(--primary))' }}>{symbol}</span>}
    </div>
  );
}

function RuneLibraryCard({ rune }: { rune: RuneData }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-3 text-left hover:opacity-80 transition-opacity"
        aria-expanded={open}>
        <RuneStone symbol={rune.symbol} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm" style={{ color: 'hsl(var(--foreground))' }}>
            {rune.name}
            <span className="font-normal ml-1.5 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {rune.altSpellings}
            </span>
          </p>
          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {rune.position} · {rune.phonetic}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 max-w-[120px] justify-end hidden sm:flex">
          {rune.keywords.slice(0, 2).map(k => (
            <span key={k} className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
              {k}
            </span>
          ))}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
          : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-5 space-y-3" style={{ borderTop: '1px solid hsl(var(--border))' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <div>
                  <SectionLabel>Historical meaning</SectionLabel>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{rune.historicalMeaning}</p>
                </div>
                <div>
                  <SectionLabel>Modern spiritual meaning</SectionLabel>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{rune.modernMeaning}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--accent-rose, var(--destructive)))' }}>Shadow</p>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{rune.shadow}</p>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--accent))' }}>
                    Contemporary magical use
                    <span className="ml-1 font-normal" style={{ color: 'hsl(var(--muted-foreground))' }}>(modern)</span>
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{rune.modernMagic}</p>
                </div>
              </div>
              {rune.noReversed && (
                <p className="text-xs italic" style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
                  Note: This rune is often considered non-reversible in modern practice due to its symmetry or the nature of its energy. Conventions vary.
                </p>
              )}
              <div className="rounded-xl p-3 space-y-2"
                style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                <p className="text-xs font-medium not-italic" style={{ color: 'hsl(var(--foreground))' }}>
                  💭 {rune.reflectionQ}
                </p>
                <p className="text-xs italic leading-relaxed">Journal: {rune.journalPrompt}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────

export default function RunesPage() {
  // Cast state
  const [selectedSpread, setSelectedSpread] = useState<SpreadId>('daily');
  const [intention, setIntention] = useState('');
  const [drawn, setDrawn] = useState<Array<{ rune: RuneData; reversed: boolean }>>([]);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [isCasting, setIsCasting] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [grimSaving, setGrimSaving] = useState(false);
  const [grimSaved, setGrimSaved] = useState(false);
  const [grimError, setGrimError] = useState<string | null>(null);

  // Library state
  const [librarySearch, setLibrarySearch] = useState('');
  const [openAett, setOpenAett] = useState<'first' | 'second' | 'third' | null>('first');

  const { data: session } = useSession();
  const spread = SPREADS.find(s => s.id === selectedSpread)!;

  async function saveToGrimoire() {
    if (!session?.user) return;
    setGrimSaving(true);
    setGrimError(null);
    try {
      const spreadObj = SPREADS.find(s => s.id === selectedSpread)!;
      const content = drawn.map((d, i) => {
        const pos = spreadObj.positions[i] ?? ('Rune ' + (i + 1));
        const reversedNote = d.reversed ? ' (Reversed)' : '';
        const meaning = d.reversed ? d.rune.shadow : d.rune.modernMeaning;
        return pos + ': ' + d.rune.name + reversedNote + '\n' + meaning;
      }).join('\n\n');
      const res = await fetch('/api/grimoire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'rune',
          title: spreadObj.name + ' Rune Reading',
          content,
          notes: intention ? 'Intention: ' + intention : '',
          tags: 'runes,' + drawn.map(d => d.rune.name.toLowerCase()).join(','),
          entryDate: new Date().toISOString().split('T')[0],
          metadata: {
            spreadId: selectedSpread,
            spreadName: spreadObj.name,
            intention,
            runes: drawn.map((d, i) => ({
              position: i + 1,
              positionLabel: spreadObj.positions[i],
              name: d.rune.name,
              symbol: d.rune.symbol,
              reversed: d.reversed,
              keywords: d.rune.keywords,
            })),
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

  const castRunes = useCallback(() => {
    setIsCasting(true);
    setRevealed(new Set());
    setExpandedCards(new Set());
    setGrimSaved(false);
    setGrimError(null);
    setTimeout(() => {
      const shuffled = shuffleArray(ALL_RUNES).slice(0, spread.count);
      setDrawn(shuffled.map(r => ({ rune: r, reversed: !r.noReversed && Math.random() > 0.7 })));
      setIsCasting(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }, 700);
  }, [spread.count]);

  function revealRune(i: number) {
    setRevealed(prev => new Set([...prev, i]));
  }

  function revealAll() {
    setRevealed(new Set(drawn.map((_, i) => i)));
  }

  const allRevealed = drawn.length > 0 && revealed.size === drawn.length;

  // Library filter
  const filterRunes = (runes: RuneData[]) => {
    if (!librarySearch.trim()) return runes;
    const q = librarySearch.toLowerCase();
    return runes.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.altSpellings.toLowerCase().includes(q) ||
      r.keywords.some(k => k.toLowerCase().includes(q)) ||
      r.historicalMeaning.toLowerCase().includes(q)
    );
  };

  const filteredFirst = filterRunes(FIRST_AETT);
  const filteredSecond = filterRunes(SECOND_AETT);
  const filteredThird = filterRunes(THIRD_AETT);
  const isSearching = librarySearch.trim().length > 0;

  return (
    <>
      <Helmet>
        <title>Rune Reading & Elder Futhark Guide | Spellful</title>
        <meta name="description" content="Cast Elder Futhark runes for reflection, explore their history and symbolism, and learn how to read runes with Spellful's free interactive guide." />
        <meta property="og:title" content="Rune Reading & Elder Futhark Guide | Spellful" />
        <meta property="og:description" content="Cast Elder Futhark runes for reflection, explore their history and symbolism, and learn how to read runes with Spellful's free interactive guide." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://spellful.com/runes" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Rune Reading & Elder Futhark Guide | Spellful" />
        <meta name="twitter:description" content="Cast Elder Futhark runes for reflection, explore their history and symbolism, and learn how to read runes with Spellful's free interactive guide." />
        <meta name="twitter:image" content="https://spellful.com/airo-assets/uploads/pages-og-image-7ff4c824.png" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <main id="main-content">

        {/* ── Hero ── */}
        <section className="py-16 px-4 text-center" aria-labelledby="runes-heading">
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-4">
            <p className="text-sm font-medium" style={{ color: 'hsl(var(--primary))' }}>{runes.hero.eyebrow}</p>
            <p className="text-4xl tracking-widest" style={{ color: 'hsl(var(--primary) / 0.6)' }}
              aria-hidden="true">ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ</p>
            <h1 id="runes-heading" className="text-4xl md:text-5xl font-serif font-bold"
              style={{ color: 'hsl(var(--foreground))' }}>
              {runes.hero.headline}
            </h1>
            <p className="text-base leading-relaxed max-w-lg mx-auto"
              style={{ color: 'hsl(var(--muted-foreground))' }}>
              {runes.hero.description}
            </p>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
              {runes.hero.supportingText}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a href="#cast"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <Sparkles className="w-4 h-4" /> {runes.hero.ctaCast}
              </a>
              <a href="#history"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium border transition-opacity hover:opacity-80"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--foreground))' }}>
                <BookOpen className="w-4 h-4" /> {runes.hero.ctaHistory}
              </a>
            </div>
          </motion.div>
        </section>

        {/* ── Page nav ── */}
        <nav aria-label="Runes page sections"
          className="sticky top-0 z-10 border-b px-4 overflow-x-auto"
          style={{ background: 'hsl(var(--background))', borderColor: 'hsl(var(--border))' }}>
          <div className="max-w-3xl mx-auto flex items-center gap-1 py-2 min-w-max">
            {[
              { href: '#cast', label: 'Cast Runes' },
              { href: '#history', label: 'History' },
              { href: '#library', label: 'Rune Library' },
              { href: '#how-to-read', label: 'How to Read' },
              { href: '#rune-magic', label: 'Rune Magic' },
            ].map(({ href, label }) => (
              <a key={href} href={href}
                className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors hover:opacity-80"
                style={{ color: 'hsl(var(--muted-foreground))' }}>
                {label}
              </a>
            ))}
          </div>
        </nav>

        {/* ══════════════════════════════════════════════════════════════════
            CAST RUNES
        ══════════════════════════════════════════════════════════════════ */}
        <section id="cast" className="py-12 px-4" aria-labelledby="cast-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="cast-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>Cast Runes</h2>
            </div>

            <div className="rounded-2xl border p-6 space-y-6"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>

              {/* Spread selector */}
              <fieldset>
                <legend className="text-sm font-medium mb-3" style={{ color: 'hsl(var(--foreground))' }}>
                  Choose your spread
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SPREADS.map(s => (
                    <button key={s.id}
                      onClick={() => { setSelectedSpread(s.id); setDrawn([]); setRevealed(new Set()); }}
                      className="rounded-xl border p-4 text-left transition-all"
                      style={{
                        background: selectedSpread === s.id ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--muted))',
                        borderColor: selectedSpread === s.id ? 'hsl(var(--primary))' : 'hsl(var(--border))',
                      }}
                      aria-pressed={selectedSpread === s.id}>
                      <p className="font-semibold text-sm" style={{ color: selectedSpread === s.id ? 'hsl(var(--primary))' : 'hsl(var(--foreground))' }}>
                        {s.name}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{s.tagline}</p>
                      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'hsl(var(--muted-foreground) / 0.8)' }}>{s.description}</p>
                    </button>
                  ))}
                </div>
              </fieldset>

              {/* Intention field */}
              <div className="space-y-1.5">
                <label htmlFor="intention-input" className="text-sm font-medium"
                  style={{ color: 'hsl(var(--foreground))' }}>
                  {runes.cast.intentionLabel}
                  <span className="ml-1.5 font-normal text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>(optional)</span>
                </label>
                <Input id="intention-input"
                  placeholder="e.g. What do I need to reflect on today?"
                  value={intention}
                  onChange={e => setIntention(e.target.value)}
                  className="bg-background" />
                <div className="flex flex-wrap gap-2 pt-1">
                  {runes.cast.suggestionQuestions.map((q: string) => (
                    <button key={q} onClick={() => setIntention(q)}
                      className="text-xs px-2.5 py-1 rounded-full border transition-opacity hover:opacity-80"
                      style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-center space-y-1">
                <p className="text-xs italic" style={{ color: 'hsl(var(--muted-foreground))' }}>
                  {runes.cast.centeringText}
                </p>
              </div>

              <Button onClick={castRunes} disabled={isCasting} className="w-full" size="lg"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                <Sparkles className="w-4 h-4 mr-2" />
                {isCasting ? 'Casting…' : drawn.length > 0 ? 'Cast Again' : `Cast My Runes`}
              </Button>
            </div>

            {/* Results */}
            <div ref={resultsRef}>
              <AnimatePresence mode="wait">
                {drawn.length > 0 && (
                  <motion.div key={drawn.map(d => d.rune.name).join(',')}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="space-y-4">

                    {intention && (
                      <div className="rounded-xl px-4 py-3 text-sm italic"
                        style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                        Your intention: <span className="not-italic font-medium" style={{ color: 'hsl(var(--foreground))' }}>{intention}</span>
                      </div>
                    )}

                    {!allRevealed && (
                      <div className="flex items-center justify-between">
                        <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {revealed.size} of {drawn.length} revealed
                        </p>
                        <button onClick={revealAll}
                          className="text-xs font-medium transition-opacity hover:opacity-70"
                          style={{ color: 'hsl(var(--primary))' }}>
                          Reveal all
                        </button>
                      </div>
                    )}

                    <div className={`grid gap-4 ${drawn.length === 1 ? 'grid-cols-1 max-w-sm mx-auto' : drawn.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                      {drawn.map((d, i) => {
                        const isRevealed = revealed.has(i);
                        return (
                          <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.12 }}>
                            <div className="rounded-2xl border overflow-hidden h-full"
                              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
                              <div className="px-4 py-2 border-b"
                                style={{ background: 'hsl(var(--muted) / 0.5)', borderColor: 'hsl(var(--border))' }}>
                                {/* eslint-disable-next-line security/detect-object-injection */}
                                <p className="text-xs text-center" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                  {spread.positions[i]}
                                </p>
                              </div>
                              {!isRevealed ? (
                                <button onClick={() => revealRune(i)}
                                  className="w-full p-8 flex flex-col items-center gap-3 transition-colors hover:opacity-80"
                                  aria-label={`Reveal rune ${i + 1}`}>
                                  <RuneStone symbol="?" faceDown size="lg" />
                                  <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>Tap to reveal</p>
                                </button>
                              ) : (
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                  className="p-5 space-y-3">
                                  <div className="flex flex-col items-center gap-2">
                                    <RuneStone symbol={d.rune.symbol} size="lg" reversed={d.reversed} />
                                    <p className="text-lg font-serif font-bold" style={{ color: 'hsl(var(--foreground))' }}>
                                      {d.rune.name}
                                    </p>
                                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                      {d.rune.phonetic} · {d.rune.altSpellings}
                                    </p>
                                    {d.reversed && (
                                      <span className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))' }}>
                                        Reversed
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {d.rune.keywords.map(k => (
                                      <span key={k} className="text-xs px-2 py-0.5 rounded-full"
                                        style={{ background: 'hsl(var(--primary) / 0.12)', color: 'hsl(var(--primary))' }}>
                                        {k}
                                      </span>
                                    ))}
                                  </div>
                                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                    {d.reversed ? d.rune.shadow : d.rune.modernMeaning}
                                  </p>
                                  {d.reversed && (
                                    <p className="text-xs italic" style={{ color: 'hsl(var(--muted-foreground) / 0.7)' }}>
                                      Note: Reversals are a modern convention, not a universal ancient practice. Conventions vary between practitioners.
                                    </p>
                                  )}
                                  <div className="rounded-xl p-3"
                                    style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                                    <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--foreground))' }}>
                                      💭 {d.rune.reflectionQ}
                                    </p>
                                  </div>
                                  {/* Expandable deeper detail */}
                                  <button
                                    onClick={() => setExpandedCards(prev => {
                                      const next = new Set(prev);
                                      if (next.has(i)) next.delete(i); else next.add(i);
                                      return next;
                                    })}
                                    className="w-full flex items-center justify-center gap-1 text-xs transition-opacity hover:opacity-70 pt-1"
                                    style={{ color: 'hsl(var(--primary))' }}>
                                    {expandedCards.has(i) ? <><ChevronUp className="w-3 h-3" /> Less detail</> : <><ChevronDown className="w-3 h-3" /> More detail</>}
                                  </button>
                                  <AnimatePresence>
                                    {expandedCards.has(i) && (
                                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                                        <div className="space-y-3 pt-1">
                                          <div>
                                            <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--primary))' }}>Historical meaning</p>
                                            <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{d.rune.historicalMeaning}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--accent))' }}>Modern spiritual meaning</p>
                                            <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{d.rune.modernMeaning}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs font-medium mb-1" style={{ color: 'hsl(var(--muted-foreground))' }}>Journal prompt</p>
                                            <p className="text-xs leading-relaxed italic" style={{ color: 'hsl(var(--muted-foreground))' }}>{d.rune.journalPrompt}</p>
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              )}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Reading summary */}
                    <AnimatePresence>
                      {allRevealed && (
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl border p-5 space-y-3"
                          style={{ background: 'hsl(var(--primary) / 0.06)', borderColor: 'hsl(var(--primary) / 0.3)' }}>
                          <p className="text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>
                            Your reading — {spread.name}
                          </p>
                          {/* Per-position summary */}
                          <div className="space-y-2">
                            {drawn.map((d, i) => (
                              <div key={i} className="flex gap-3 items-start">
                                <span className="text-base flex-shrink-0 mt-0.5" style={{ color: 'hsl(var(--primary))' }}>{d.rune.symbol}</span>
                                <div>
                                  {/* eslint-disable-next-line security/detect-object-injection */}
                                  <p className="text-xs font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                                    {spread.positions[i]}: <span style={{ color: 'hsl(var(--primary))' }}>{d.rune.name}</span>
                                    {d.reversed && <span className="ml-1.5 text-xs" style={{ color: 'hsl(var(--destructive))' }}>(reversed)</span>}
                                  </p>
                                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                                    {d.rune.keywords.join(' · ')}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          {intention && (
                            <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                              {drawn.length === 1 && `In the context of "${intention}" — ${drawn[0].rune.name} invites you to sit with its themes of ${drawn[0].rune.keywords.slice(0, 2).join(' and ')}.`}
                              {drawn.length === 3 && `For "${intention}" — ${drawn[0].rune.name} speaks to what has shaped this, ${drawn[1].rune.name} reflects where you are now, and ${drawn[2].rune.name} points toward what is emerging.`}
                              {drawn.length === 5 && `For "${intention}" — your five runes trace the situation through challenge, guidance, action, and possible direction. Notice which themes feel most alive.`}
                            </p>
                          )}
                          {!intention && (
                            <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                              {drawn.length === 1 && `${drawn[0].rune.name} has appeared as your message. Sit with its themes — ${drawn[0].rune.keywords.join(', ')} — and notice what resonates.`}
                              {drawn.length === 3 && `${drawn[0].rune.name}, ${drawn[1].rune.name}, and ${drawn[2].rune.name} trace a thread from what has shaped this moment, through where you stand now, toward what is emerging.`}
                              {drawn.length === 5 && `Your five runes offer a layered picture. The runes speak in symbols; trust your intuition to find the connections that feel most alive for you.`}
                            </p>
                          )}
                          <p className="text-xs italic" style={{ color: 'hsl(var(--muted-foreground) / 0.8)' }}>
                            {runes.cast.readingDisclaimer}
                          </p>
                          {/* End-of-reading actions */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            <Button onClick={castRunes} variant="outline" size="sm"
                              style={{ borderColor: 'hsl(var(--primary) / 0.4)', color: 'hsl(var(--primary))' }}>
                              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Cast Again
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
                            <a href="#library"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-opacity hover:opacity-80"
                              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                              <Search className="w-3.5 h-3.5" /> Explore These Runes
                            </a>
                            <a href="#how-to-read"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium transition-opacity hover:opacity-80"
                              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
                              <BookOpen className="w-3.5 h-3.5" /> How to Read Runes
                            </a>
                          </div>
                          {grimError && (
                            <p className="text-xs" style={{ color: 'hsl(var(--destructive))' }}>{grimError}</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            HISTORY & MYTHOLOGY
        ══════════════════════════════════════════════════════════════════ */}
        <section id="history" className="py-12 px-4" aria-labelledby="history-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="history-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>History &amp; Mythology</h2>
            </div>

            <div className="rounded-2xl border p-5 text-sm leading-relaxed space-y-4"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--muted-foreground))' }}>
              <p>
                {runes.historyIntro}
              </p>

              {[
                {
                  title: 'Origins of the Runes',
                  body: 'The earliest widely accepted runic inscriptions date to around the second century CE, though some discoveries may be earlier. Runes were used by Germanic-speaking peoples across a wide geographic area — from Scandinavia to the British Isles and continental Europe. Their origins are debated among scholars; possible influences include earlier Mediterranean alphabets such as the Old Italic scripts, though the precise transmission remains uncertain. Runes were carved into wood, bone, stone, and metal. They were primarily a writing system used for practical communication, names, and memorials — not exclusively a magical system, though some inscriptions do appear to have ritual or protective purposes.',
                },
                {
                  title: 'The Elder Futhark',
                  body: 'The Elder Futhark is the oldest broadly attested runic alphabet, consisting of 24 characters. It takes its name from the sounds of its first six runes: F, U, Þ (th), A, R, K. Modern scholars conventionally divide it into three groups of eight called aettir (singular: aett), though this division is not consistently attested in early sources. The names of the Elder Futhark runes are largely reconstructed from later runic poems and related languages — they are not directly attested in the earliest inscriptions. The Elder Futhark was in use from roughly the second to eighth centuries CE. It predates the Viking Age; the Norse Vikings primarily used the Younger Futhark, a reduced 16-character alphabet.',
                },
                {
                  title: 'Odin and the Discovery of the Runes',
                  body: 'In Norse mythology, Odin\'s pursuit of knowledge leads him to hang upon a tree — commonly identified as Yggdrasil, the world tree — for nine nights, wounded and without food or drink. In the poem Hávamál, he gains knowledge of the runes through this ordeal. The story expresses themes of sacrifice, wisdom, and transformation that resonate deeply in modern spiritual practice. It is a mythological account rather than a historical explanation of the invention of writing, and it belongs to the Norse tradition specifically — not to the broader Germanic cultures that used earlier runic alphabets.',
                },
                {
                  title: 'Runes in Everyday Life and Ritual',
                  body: 'Historical runic inscriptions served many purposes: recording names and ownership, commemorating the dead, marking crafted objects, and communicating across distances. Some inscriptions appear to have had ritual, protective, or magical intent — carved amulets, curse tablets, and objects with repeated or unusual rune sequences suggest a range of uses. However, historical evidence does not establish a standardized ancient divination system identical to the modern one-, three-, or five-rune spreads used in contemporary practice. Those reading methods are modern developments.',
                },
                {
                  title: 'Runes in Modern Witchcraft and Spiritual Practice',
                  body: 'The modern revival of rune symbolism in divination, meditation, intention-setting, journaling, and spellwork developed primarily in the nineteenth and twentieth centuries, drawing on scholarly runology, Romantic-era interest in Norse mythology, and later esoteric traditions. Contemporary rune practice is diverse and creative. It is worth noting that the esoteric revival of runes in the early twentieth century included ideological appropriations that have no place in modern spiritual practice — most contemporary practitioners draw a clear distinction between their spiritual work and those historical misuses. Today, runes are widely used as tools for reflection, personal growth, and connection with northern European ancestral traditions.',
                },
              ].map(({ title, body }) => (
                <div key={title} className="pl-4" style={{ borderLeft: '2px solid hsl(var(--primary) / 0.4)' }}>
                  <p className="font-semibold text-sm mb-1" style={{ color: 'hsl(var(--foreground))' }}>{title}</p>
                  <p className="text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div className="rounded-2xl border p-5 space-y-4"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
              <h3 className="text-lg font-serif font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                Historical Timeline
              </h3>
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                Dates are approximate and reflect scholarly consensus; regional variation was significant.
              </p>
              <div className="space-y-4">
                {[
                  { period: 'Around 2nd–8th centuries CE', label: 'Elder Futhark', body: 'The earliest broadly attested runic alphabet, with 24 characters, used across Germanic-speaking northern Europe.' },
                  { period: 'Around 5th century CE onward', label: 'Anglo-Saxon Futhorc', body: 'Develops and expands in England and Frisia, eventually growing to 28–33 characters to represent sounds in Old English.' },
                  { period: 'Around 8th–11th centuries CE', label: 'Younger Futhark', body: 'A reduced 16-character alphabet becomes widespread in Viking Age Scandinavia — the alphabet most associated with the Norse Vikings.' },
                  { period: 'Around 12th–15th centuries and beyond', label: 'Medieval runes', body: 'Continue in use alongside Latin writing; some regional traditions, including the Dalecarlian runes of Sweden, persist into the modern era.' },
                  { period: '19th–20th centuries', label: 'Scholarly and esoteric revival', body: 'Renewed academic interest in runology alongside cultural and esoteric revivals. This period also includes ideological misappropriations that modern practitioners reject.' },
                  { period: 'Present day', label: 'Contemporary practice', body: 'Runes continue to be studied as historical writing and used in diverse modern spiritual practices including divination, meditation, and personal reflection.' },
                ].map(({ period, label, body }) => (
                  <div key={period} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1"
                        style={{ background: 'hsl(var(--primary))' }} />
                      <div className="w-px flex-1 mt-1" style={{ background: 'hsl(var(--border))' }} />
                    </div>
                    <div className="pb-4 min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'hsl(var(--primary))' }}>{period}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: 'hsl(var(--foreground))' }}>{label}</p>
                      <p className="text-xs leading-relaxed mt-1" style={{ color: 'hsl(var(--muted-foreground))' }}>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl p-4 flex gap-2"
              style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                {runes.sourceNote}
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            RUNE LIBRARY
        ══════════════════════════════════════════════════════════════════ */}
        <section id="library" className="py-12 px-4" aria-labelledby="library-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="library-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>Rune Library</h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {runes.libraryIntro}
            </p>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: 'hsl(var(--muted-foreground))' }} />
              <Input
                placeholder="Search by name, keyword, or meaning…"
                value={librarySearch}
                onChange={e => setLibrarySearch(e.target.value)}
                className="pl-9 bg-background"
                aria-label="Search runes" />
            </div>

            {isSearching ? (
              <div className="space-y-2">
                {[...filteredFirst, ...filteredSecond, ...filteredThird].length === 0 ? (
                  <p className="text-sm text-center py-8" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    No runes match "{librarySearch}"
                  </p>
                ) : (
                  [...filteredFirst, ...filteredSecond, ...filteredThird].map(r => (
                    <RuneLibraryCard key={r.name} rune={r} />
                  ))
                )}
              </div>
            ) : (
              <>
                {([
                  { id: 'first' as const, label: 'First Aett', subtitle: 'Fehu through Wunjo — themes of the material world, communication, and joy', aettRunes: FIRST_AETT },
                  { id: 'second' as const, label: 'Second Aett', subtitle: 'Hagalaz through Sowilo — themes of disruption, necessity, and inner forces', aettRunes: SECOND_AETT },
                  { id: 'third' as const, label: 'Third Aett', subtitle: 'Tiwaz through Othala — themes of justice, growth, and heritage', aettRunes: THIRD_AETT },
                ]).map(({ id, label, subtitle, aettRunes }) => (
                  <div key={id} className="space-y-2">
                    <button
                      onClick={() => setOpenAett(openAett === id ? null : id)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-opacity hover:opacity-80"
                      style={{ background: 'hsl(var(--muted))', borderColor: 'hsl(var(--border))' }}
                      aria-expanded={openAett === id}>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'hsl(var(--foreground))' }}>{label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))' }}>{subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>
                          {aettRunes.map((r: RuneData) => r.symbol).join(' ')}
                        </span>
                        {openAett === id
                          ? <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
                          : <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />}
                      </div>
                    </button>
                    <AnimatePresence>
                      {openAett === id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                          <div className="space-y-2 pt-1">
                            {aettRunes.map((r: RuneData) => <RuneLibraryCard key={r.name} rune={r} />)}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </>
            )}
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            HOW TO READ RUNES
        ══════════════════════════════════════════════════════════════════ */}
        <section id="how-to-read" className="py-12 px-4" aria-labelledby="howto-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="howto-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>How to Read Runes</h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {runes.howToIntro}
            </p>

            <div className="space-y-3">
              {[
                {
                  step: '1', title: 'Set your intention',
                  body: 'Before drawing runes, take a moment to become still. You might close your eyes, take a few slow breaths, or simply pause. Hold a question or area of your life in mind — something open-ended works better than a yes/no question. Examples: "What do I need to pay attention to right now?" or "What is the underlying dynamic in this situation?" You do not need to speak your intention aloud, but some people find it helpful.',
                },
                {
                  step: '2', title: 'Choose a spread',
                  body: 'A spread is the number of runes you draw and the positions you assign them. Common modern spreads include a single rune for daily reflection, three runes for a past-present-future or situation-challenge-guidance reading, and five runes for a more layered exploration. These are contemporary conventions — there is no historically documented standard spread. Choose what feels right for your question.',
                },
                {
                  step: '3', title: 'Cast or draw',
                  body: 'Traditionally, runes were cast (thrown) onto a cloth and the ones that landed face-up were read. In modern practice, many people draw runes from a bag without looking. Both methods work. The key is to engage with the process intentionally rather than mechanically. Use this app\'s Cast Runes tool, or work with a physical set if you have one.',
                },
                {
                  step: '4', title: 'Interpret each rune in its position',
                  body: 'Read each rune in relation to its position in the spread. A rune in the "challenge" position is read differently than the same rune in the "guidance" position. Consider both the rune\'s general themes and how those themes apply to the specific position. There is no single correct interpretation — your intuitive response to a rune is part of the reading.',
                },
                {
                  step: '5', title: 'Connect the themes',
                  body: 'After reading each rune individually, step back and look at the spread as a whole. What threads run through the runes? Do they reinforce each other, or create tension? A reading is a conversation between symbols, not a list of separate messages. Notice what resonates and what surprises you.',
                },
                {
                  step: '6', title: 'Journal and reflect',
                  body: 'Writing about a reading deepens its value. Note which runes appeared, what positions they occupied, what your immediate reactions were, and what questions the reading raised. Revisiting your notes over time can reveal patterns and growth. The reflection question included with each rune profile is a starting point.',
                },
              ].map(({ step, title, body }) => (
                <div key={step} className="rounded-2xl border p-4 flex gap-4"
                  style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }}>
                    {step}
                  </div>
                  <div>
                    <p className="font-semibold text-sm mb-1" style={{ color: 'hsl(var(--foreground))' }}>{title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border p-5 space-y-3"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
              <h3 className="text-base font-semibold" style={{ color: 'hsl(var(--foreground))' }}>
                A note on reversals and the blank rune
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                <strong style={{ color: 'hsl(var(--foreground))' }}>Reversals</strong> — reading a rune upside-down as having a different or shadow meaning — are a modern convention, not a universal or historically documented requirement. Some practitioners use them; others do not. Neither approach is more authentic. This app offers reversed interpretations as an option, not a rule.
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
                <strong style={{ color: 'hsl(var(--foreground))' }}>The blank rune</strong> is not part of the historical Elder Futhark alphabet. It was introduced in modern rune sets and is sometimes called the "Odin rune" or "Wyrd." Its use is entirely optional and contemporary. This app does not include it.
              </p>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════════════
            RUNE MAGIC
        ══════════════════════════════════════════════════════════════════ */}
        <section id="rune-magic" className="py-12 px-4" aria-labelledby="magic-heading">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
              <h2 id="magic-heading" className="text-2xl font-serif font-bold"
                style={{ color: 'hsl(var(--foreground))' }}>Rune Magic</h2>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {runes.magicIntro}
            </p>

            <div className="space-y-3">
              {[
                {
                  title: 'Rune Meditation',
                  tag: 'Contemporary practice',
                  body: 'Choose a rune that speaks to a quality you want to cultivate or a question you are sitting with. Spend a few minutes gazing at the symbol, drawing it, or simply holding it in mind. Notice what images, feelings, or thoughts arise. This is a form of focused contemplation — the rune serves as a focal point for your own inner wisdom rather than as a magical object with independent power.',
                  exercise: 'Choose one rune from the library above. Sit quietly for five minutes with its symbol in mind. Afterward, write three words that arose for you.',
                },
                {
                  title: 'Intention-Setting with Runes',
                  tag: 'Contemporary practice',
                  body: 'Select a rune whose themes align with an intention you are working with — Fehu for abundance, Berkano for new beginnings, Sowilo for clarity. Write the rune symbol alongside your intention, place it somewhere visible, or carry it as a reminder. This is a symbolic practice: the rune acts as a visual anchor for your intention, not as a mechanism that produces outcomes independently of your actions.',
                  exercise: 'Identify one intention you are working with this month. Find the rune in the library whose themes resonate most. Write both the rune symbol and your intention in your journal.',
                },
                {
                  title: 'Rune Talismans',
                  tag: 'Historical roots, modern practice',
                  body: 'Historical inscriptions do include objects that appear to have been created with protective or ritual intent — amulets, weapons, and personal items bearing rune sequences. Modern rune talismans draw inspiration from this tradition while being a contemporary practice. A talisman might be a stone, piece of wood, or paper inscribed with a rune or combination of runes held to represent a desired quality or protection. The meaning is symbolic and personal.',
                  exercise: 'Find a small stone or piece of paper. Draw a rune that represents something you want to carry with you. Hold it while reflecting on your intention.',
                },
                {
                  title: 'Bindrunes',
                  tag: 'Historical roots, modern practice',
                  body: 'A bindrune combines two or more rune characters into a single symbol by overlapping or joining their staves. Historical bindrunes appear in inscriptions and appear to have served various purposes. Many modern magical bindrunes are contemporary symbolic designs rather than direct continuations of historical practice. Creating a bindrune today is a creative and meditative act — combining the themes of two or more runes into a personal symbol for an intention or quality you want to embody.',
                  exercise: 'Choose two runes whose themes complement each other for something you are working on. Sketch ways to combine their shapes into a single symbol. Reflect on what the combination means to you.',
                },
                {
                  title: 'Rune Journaling',
                  tag: 'Contemporary practice',
                  body: 'Draw a rune each morning as a focal point for the day. Write about how its themes appear in your life — in your relationships, your work, your inner experience. Over time, a rune journal becomes a record of your reflective practice and a way to deepen your relationship with the symbols. This is perhaps the most accessible and grounded way to work with runes.',
                  exercise: 'For one week, draw a single rune each morning using the Daily Guidance spread. Write three sentences about how its themes might apply to your day. Review your entries at the end of the week.',
                },
              ].map(({ title, tag, body, exercise }) => (
                <div key={title} className="rounded-2xl border p-5 space-y-3"
                  style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm" style={{ color: 'hsl(var(--foreground))' }}>{title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                      style={{ background: 'hsl(var(--accent) / 0.15)', color: 'hsl(var(--accent))' }}>
                      {tag}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'hsl(var(--muted-foreground))' }}>{body}</p>
                  <div className="rounded-xl p-3"
                    style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
                    <p className="text-xs font-medium not-italic mb-1" style={{ color: 'hsl(var(--foreground))' }}>
                      ✦ Try it
                    </p>
                    <p className="text-xs leading-relaxed italic">{exercise}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-4 flex gap-2"
              style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}>
              <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed">
                {runes.magicDisclaimer}
              </p>
            </div>
          </div>
        </section>

        <div className="h-16" />
      </main>
    </>
  );
}
