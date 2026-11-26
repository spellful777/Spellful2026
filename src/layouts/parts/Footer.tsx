import { useState, useEffect, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Bell, MessageSquare } from 'lucide-react';
import { useSession } from '@/lib/auth/auth-client';
import { COMMUNITY_FEED, COMMUNITY_GROUPS, COMMUNITY_UPDATES } from '@/lib/community-navigation';
import { getMoonPhase } from '@/lib/moon-phase-engine';
import myCovenWordmark from '@/assets/my-coven-wordmark.png';

// ─── Seeded star field (SSR-safe) ────────────────────────────────────────────
function seededRand(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 55 }, (_, i) => ({
  id: i,
  top: `${seededRand(i * 7) * 100}%`,
  left: `${seededRand(i * 7 + 1) * 100}%`,
  size: seededRand(i * 7 + 2) * 1.6 + 0.4,
  anim: i % 3 === 0 ? 'twinkle-slow' : i % 3 === 1 ? 'twinkle' : 'twinkle-fast',
  dur: `${2.8 + seededRand(i * 11) * 4.5}s`,
  delay: `${seededRand(i * 19) * 7}s`,
  opacity: 0.25 + seededRand(i * 7 + 3) * 0.55,
  gold: i % 7 === 0,
  lavender: i % 11 === 0,
}));

// Constellation dots for the divider
const CONSTELLATION_DOTS = Array.from({ length: 8 }, (_, i) => ({
  id: i,
  x: 5 + i * 13 + seededRand(i * 3) * 4,
  y: seededRand(i * 3 + 1),
}));

// ─── Moon phase glyphs ────────────────────────────────────────────────────────
const PHASE_GLYPHS: Record<string, string> = {
  'New Moon': '\u{1F311}',
  'Waxing Crescent': '\u{1F312}',
  'First Quarter': '\u{1F313}',
  'Waxing Gibbous': '\u{1F314}',
  'Full Moon': '\u{1F315}',
  'Waning Gibbous': '\u{1F316}',
  'Last Quarter': '\u{1F317}',
  'Waning Crescent': '\u{1F318}',
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Footer() {
  const { isAuthenticated } = useSession();
  const [moonPhase, setMoonPhase] = useState('Full Moon');
  const [moonIllum, setMoonIllum] = useState(100);
  const [mounted, setMounted] = useState(false);
  const [wordmarkVisible, setWordmarkVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
    const data = getMoonPhase();
    setMoonPhase(data.phase);
    setMoonIllum(Math.round(data.illumination));
  }, []);

  const grimDest = isAuthenticated ? '/grimoire' : '/login?redirect=/grimoire';
  const glyph = PHASE_GLYPHS[moonPhase] ?? '\u{1F315}';

  return (
    <footer
      className="relative overflow-hidden"
      aria-label="Site footer"
      style={{
        background: 'linear-gradient(180deg, hsl(var(--muted)) 0%, hsl(var(--footer-bg-deep)) 55%, hsl(var(--footer-bg-darkest)) 100%)',
        borderTop: '1px solid hsl(var(--border))',
      }}
    >
      {/* Star field */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {STARS.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full"
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              opacity: s.opacity,
              background: s.gold
                ? 'hsl(var(--footer-gold))'
                : s.lavender
                ? 'hsl(var(--footer-lavender))'
                : 'hsl(var(--footer-ivory))',
              boxShadow: s.gold
                ? `0 0 ${s.size * 4}px 1px hsl(var(--footer-gold) / 0.5)`
                : undefined,
              animationName: s.anim,
              animationDuration: s.dur,
              animationDelay: s.delay,
              animationIterationCount: 'infinite',
              animationTimingFunction: 'ease-in-out',
            }}
          />
        ))}
      </div>

      {/* 1. Celestial Divider */}
      <div className="relative flex flex-col items-center pt-10 pb-2" aria-hidden="true">
        <div
          className="relative mb-3 text-3xl select-none"
          style={{
            filter: 'drop-shadow(0 0 10px hsl(var(--footer-gold) / 0.6)) drop-shadow(0 0 22px hsl(var(--footer-gold) / 0.25))',
            animationName: 'footer-moon-glow',
            animationDuration: '3.5s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
        >
          &#x1F319;
        </div>
        <div className="relative w-full max-w-2xl px-6">
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="w-full" style={{ height: '20px' }}>
            <line x1="0" y1="10" x2="100" y2="10" stroke="hsl(var(--footer-gold))" strokeWidth="0.3" strokeOpacity="0.55" />
            {CONSTELLATION_DOTS.map((d) => (
              <circle key={d.id} cx={d.x} cy={7 + d.y * 6} r="0.8" fill="hsl(var(--footer-gold))" fillOpacity="0.7" />
            ))}
            {CONSTELLATION_DOTS.slice(0, -1).map((d, i) => (
              <line
                key={`cl-${i}`}
                x1={d.x} y1={7 + d.y * 6}
                x2={CONSTELLATION_DOTS[i + 1].x} y2={7 + CONSTELLATION_DOTS[i + 1].y * 6}
                stroke="hsl(var(--footer-gold))" strokeWidth="0.2" strokeOpacity="0.3"
              />
            ))}
          </svg>
        </div>
      </div>

      {/* 2. Main Message */}
      <motion.div
        className="relative z-10 flex flex-col items-center text-center px-6 pt-8 pb-6"
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: 'easeOut' as const }}
      >
        <h2
          className="text-3xl sm:text-4xl md:text-5xl mb-4 leading-tight"
          style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--footer-ivory))', letterSpacing: '0.01em' }}
        >
          Your{' '}
          <em style={{ fontStyle: 'italic', color: 'hsl(var(--footer-gold))', textShadow: '0 0 18px hsl(var(--footer-gold) / 0.4)' }}>
            magic
          </em>{' '}
          continues here.
        </h2>
        <p
          className="text-sm sm:text-base max-w-sm"
          style={{ color: 'hsl(var(--footer-lavender))', fontFamily: 'var(--font-sans)', fontWeight: 300, lineHeight: 1.7 }}
        >
          Return to your rituals, explore the stars,
          <br className="hidden sm:block" /> and find your circle.
        </p>
      </motion.div>

      {/* Thin separator */}
      <div
        className="relative z-10 mx-auto max-w-lg h-px mb-8"
        style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--footer-gold) / 0.3), transparent)' }}
      />

      {/* 4. Minimal Navigation */}
      <motion.div
        className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 px-6 pb-8"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Link to="/" className="shrink-0" aria-label="Spellful home">
          <img
            src="/airo-assets/images/logo/official-white"
            alt="Spellful"
            className="block h-auto w-auto object-contain"
            style={{
              maxHeight: '36px',
              maxWidth: '140px',
              filter: 'drop-shadow(0 0 6px hsl(var(--footer-gold) / 0.4))',
            }}
          />
        </Link>

        <nav
          aria-labelledby="footer-coven-heading"
          className="relative flex shrink-0 flex-col items-center"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-7 -inset-y-3"
            style={{ background: 'radial-gradient(ellipse at 50% 32%, hsl(var(--footer-gold) / 0.13), transparent 72%)' }}
          />
          <Link
            to={COMMUNITY_FEED}
            className="coven-press group relative inline-flex flex-col items-center gap-1 rounded-lg px-2 pb-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <motion.h2
              id="footer-coven-heading"
              className="coven-footer-wordmark relative"
              data-shimmer={wordmarkVisible ? 'true' : undefined}
              style={{ '--coven-wordmark-image': `url("${myCovenWordmark}")` } as CSSProperties}
              viewport={{ once: true, amount: 0.6 }}
              onViewportEnter={() => setWordmarkVisible(true)}
            >
              <span className="sr-only">My Coven</span>
              <img
                src={myCovenWordmark}
                alt=""
                width={640}
                height={211}
                loading="lazy"
                className="block h-auto w-52"
              />
            </motion.h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[hsl(var(--footer-gold))] px-3 py-1.5 text-xs font-semibold text-[hsl(var(--coven-lilac-ink))] transition-colors group-hover:bg-[hsl(44_80%_78%)]">
              Open feed
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </span>
          </Link>
          <ul className="relative flex flex-wrap items-center justify-center gap-x-3 sm:justify-start">
            {[
              { label: 'Updates', to: COMMUNITY_UPDATES, icon: Bell },
              { label: 'Groups', to: COMMUNITY_GROUPS, icon: MessageSquare },
            ].map(({ label, to, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="coven-press inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm text-[hsl(var(--footer-lavender))] transition-colors hover:text-[hsl(var(--footer-gold))] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <Icon className="size-3.5 shrink-0 text-[hsl(var(--footer-gold))]" aria-hidden="true" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <span aria-hidden="true" className="hidden h-10 w-px bg-[hsl(var(--footer-gold)/0.2)] sm:block" />

        <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {[
            { label: 'Explore', href: '/spells' },
            { label: 'My Grimoire', href: grimDest },
          ].map((l) => (
            <Link
              key={l.href}
              to={l.href}
              className="text-xs transition-colors duration-200 hover:text-primary"
              style={{ color: 'hsl(var(--footer-lavender))', fontFamily: 'var(--font-sans)', fontWeight: 400 }}
            >
              {l.label}
            </Link>
          ))}
          <span className="text-xs opacity-20" style={{ color: 'hsl(var(--footer-ivory))' }} aria-hidden="true">
            &middot;
          </span>
          {[
            { label: 'Privacy', href: '/privacy' },
            { label: 'Terms', href: '/terms' },
          ].map((l) => (
            <Link
              key={l.href}
              to={l.href}
              className="text-xs transition-colors duration-200 hover:text-primary"
              style={{ color: 'hsl(var(--footer-lavender) / 0.5)', fontFamily: 'var(--font-sans)', fontWeight: 300 }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </motion.div>

      {/* 5. Lunar Phase Indicator */}
      <div
        className="relative z-10 flex justify-center sm:justify-end items-center gap-2 px-6 pb-6 sm:absolute sm:bottom-6 sm:right-6 sm:pb-0"
        aria-label={`Current moon phase: ${moonPhase}`}
      >
        <span
          className="text-xl leading-none select-none"
          style={{
            filter: 'drop-shadow(0 0 8px hsl(var(--footer-gold) / 0.6))',
            animationName: mounted ? 'footer-moon-glow' : undefined,
            animationDuration: '4s',
            animationIterationCount: 'infinite',
            animationTimingFunction: 'ease-in-out',
          }}
          aria-hidden="true"
        >
          {glyph}
        </span>
        <div className="flex flex-col items-start">
          <span
            className="text-xs leading-tight"
            style={{ color: 'hsl(var(--footer-gold))', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
          >
            {moonPhase}
          </span>
          <span
            className="text-xs leading-tight"
            style={{ color: 'hsl(var(--footer-lavender) / 0.6)', fontFamily: 'var(--font-sans)', fontWeight: 300 }}
          >
            {mounted ? `${moonIllum}% illuminated` : ''}
          </span>
        </div>
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes footer-moon-glow {
          0%, 100% { filter: drop-shadow(0 0 8px hsl(var(--footer-gold) / 0.6)) drop-shadow(0 0 20px hsl(var(--footer-gold) / 0.2)); }
          50%       { filter: drop-shadow(0 0 16px hsl(var(--footer-gold) / 0.9)) drop-shadow(0 0 36px hsl(var(--footer-gold) / 0.4)); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="footer-moon-glow"], [style*="twinkle"] { animation: none !important; }
        }
      `}</style>
    </footer>
  );
}
