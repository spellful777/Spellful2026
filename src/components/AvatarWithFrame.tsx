/**
 * AvatarWithFrame — shared component used by Profile Studio AND the live
 * /u/[username] public profile. Renders a circular avatar with an optional
 * decorative Plus-member frame overlaid as a full-bleed image.
 *
 * Each frame is a separate PNG with a transparent centre so the avatar shows
 * through. Frames are served from individual media slots:
 *   /airo-assets/images/profile-frames/frame-1  … frame-10
 *
 * Props:
 *   src          — uploaded avatar URL (takes priority over preset)
 *   avatarPreset — key for a default witch-hat avatar slot
 *   frameKey     — one of the FRAME_DEFS keys, or '' for none
 *   size         — diameter in px (default 96); frame scales with it
 *   isPlus       — whether the viewer/owner has Plus (gates frame rendering)
 *   showLock     — show a lock badge on Plus-only frames when !isPlus (picker)
 *   alt          — alt text for the avatar image
 *   className    — extra classes on the outer wrapper
 */
import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

// ─── Reduced-motion hook ──────────────────────────────────────────────────────
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

// ─── Frame catalogue ──────────────────────────────────────────────────────────
// 10 Plus frames, each served from its own media slot.
// Keys must match the values stored in user.avatarFrame in the DB.

export type FrameKey =
  | ''
  | 'frame-1'
  | 'frame-2'
  | 'frame-3'
  | 'frame-4'
  | 'frame-5'
  | 'frame-6'
  | 'frame-7'
  | 'frame-8'
  | 'frame-9'
  | 'frame-10';

export type FrameDef = {
  key: FrameKey;
  label: string;
  plusOnly: boolean;
  /** Slot URL for the frame PNG (transparent centre, decorative outer ring) */
  src: string;
};

export const FRAME_DEFS: FrameDef[] = [
  { key: 'frame-1',  label: 'Floral Moon',      plusOnly: true, src: '/airo-assets/images/profile-frames/frame-1'  },
  { key: 'frame-2',  label: 'Lotus Gold',      plusOnly: true, src: '/airo-assets/images/profile-frames/frame-2'  },
  { key: 'frame-3',  label: 'Mystic Stars',    plusOnly: true, src: '/airo-assets/images/profile-frames/frame-3'  },
  { key: 'frame-4',  label: 'Pentagram',       plusOnly: true, src: '/airo-assets/images/profile-frames/frame-4'  },
  { key: 'frame-5',  label: 'Ocean Wave',      plusOnly: true, src: '/airo-assets/images/profile-frames/frame-5'  },
  { key: 'frame-6',  label: 'Golden Celestial',plusOnly: true, src: '/airo-assets/images/profile-frames/frame-6'  },
  { key: 'frame-7',  label: 'Amethyst',        plusOnly: true, src: '/airo-assets/images/profile-frames/frame-7'  },
  { key: 'frame-8',  label: 'Enchanted Forest',plusOnly: true, src: '/airo-assets/images/profile-frames/frame-8'  },
  { key: 'frame-9',  label: 'Fairy Wings',     plusOnly: true, src: '/airo-assets/images/profile-frames/frame-9'  },
  { key: 'frame-10', label: 'Moon Mist',       plusOnly: true, src: '/airo-assets/images/profile-frames/frame-10' },
];

// ─── Default avatar presets ───────────────────────────────────────────────────
export const DEFAULT_AVATARS: { key: string; src: string; label: string }[] = [
  { key: 'hat-black',   src: '/airo-assets/images/avatars/default-hat-black',   label: 'Black Hat'   },
  { key: 'hat-blue',    src: '/airo-assets/images/avatars/default-hat-blue',    label: 'Blue Hat'    },
  { key: 'hat-green',   src: '/airo-assets/images/avatars/default-hat-green',   label: 'Green Hat'   },
  { key: 'hat-orange',  src: '/airo-assets/images/avatars/default-hat-orange',  label: 'Orange Hat'  },
  { key: 'hat-purple',  src: '/airo-assets/images/avatars/default-hat-purple',  label: 'Purple Hat'  },
  { key: 'hat-rainbow', src: '/airo-assets/images/avatars/default-hat-rainbow', label: 'Rainbow Hat' },
  { key: 'hat-red',     src: '/airo-assets/images/avatars/default-hat-red',     label: 'Red Hat'     },
  { key: 'hat-trans',   src: '/airo-assets/images/avatars/default-hat-trans',   label: 'Trans Hat'   },
  { key: 'hat-lesbian', src: '/airo-assets/images/avatars/default-hat-lesbian', label: 'Lesbian Hat' },
];

// ─── Props ────────────────────────────────────────────────────────────────────
export interface AvatarWithFrameProps {
  src?: string | null;
  avatarPreset?: string;
  frameKey?: string;
  size?: number;
  isPlus?: boolean;
  showLock?: boolean;
  alt?: string;
  className?: string;
}

// ─── Per-frame glimmer color themes ──────────────────────────────────────────
// Each frame gets a [highlightColor, glowColor] pair tuned to its artwork.
// Colors are intentionally muted — these are light reflections, not particles.
const FRAME_GLIMMER_COLORS: Record<string, [string, string]> = {
  'frame-1':  ['#f8e8b8', '#f8e8b830'], // Floral Moon      — warm ivory-gold
  'frame-2':  ['#f0d878', '#f0d87828'], // Lotus Gold       — soft gold
  'frame-3':  ['#e0d0f8', '#e0d0f828'], // Mystic Stars     — silver-lavender
  'frame-4':  ['#d8c8f0', '#d8c8f025'], // Pentagram        — pale violet
  'frame-5':  ['#c8e8f8', '#c8e8f828'], // Ocean Wave       — cool aqua-white
  'frame-6':  ['#f8e090', '#f8e09028'], // Golden Celestial — warm gold
  'frame-7':  ['#dcc8f8', '#dcc8f825'], // Amethyst         — soft purple-white
  'frame-8':  ['#c8f0d0', '#c8f0d025'], // Enchanted Forest — pale mint
  'frame-9':  ['#f8d8f0', '#f8d8f025'], // Fairy Wings      — blush iridescent
  'frame-10': ['#e0d8ff', '#e0d8ff25'], // Moon Mist        — cool silver-lilac
};

// ─── Anchor pool — 12 positions around the frame perimeter ───────────────────
// [cx%, cy%] — all hug the outer ring, none overlap the avatar face area.
// The JS scheduler picks a random subset each time so positions vary.
const ANCHOR_POOL: [number, number][] = [
  [ 50,   5], // top-center
  [ 72,   8], // top-right
  [ 88,  20], // upper-right
  [ 95,  42], // right-upper
  [ 95,  60], // right-lower
  [ 85,  82], // lower-right
  [ 62,  93], // bottom-right
  [ 38,  93], // bottom-left
  [ 15,  82], // lower-left
  [  5,  60], // left-lower
  [  5,  40], // left-upper
  [ 14,  18], // upper-left
];

// ─── Active glimmer state ─────────────────────────────────────────────────────
interface GlimmerState {
  id: number;
  cx: number;   // px from left of wrapper
  cy: number;   // px from top of wrapper
  s: number;    // half-size in px
  opacity: number;
  phase: 'in' | 'peak' | 'out' | 'done';
  glowPx: number;
}

// Seeded pseudo-random so SSR and client produce the same initial render,
// avoiding hydration mismatches. Each call advances the seed.
function makePrng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// Build a thin 4-point flare SVG path string for a given half-size s.
function flarePath(s: number): string {
  const t = s;
  const w = Math.max(1, Math.round(s * 0.15));
  return (
    `M0,${-t} C${w},${-w} ${w},${-w} 0,0 C${-w},${-w} ${-w},${-w} 0,${-t} ` +
    `M${t},0 C${w},${w} ${w},${w} 0,0 C${w},${-w} ${w},${-w} ${t},0 ` +
    `M0,${t} C${-w},${w} ${-w},${w} 0,0 C${w},${w} ${w},${w} 0,${t} ` +
    `M${-t},0 C${-w},${-w} ${-w},${-w} 0,0 C${-w},${w} ${-w},${w} ${-t},0`
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AvatarWithFrame({
  src,
  avatarPreset,
  frameKey = '',
  size = 96,
  isPlus = false,
  showLock = false,
  alt = 'Avatar',
  className = '',
}: AvatarWithFrameProps) {
  const prefersReduced = usePrefersReducedMotion();

  // Resolve avatar image source
  const presetSrc = avatarPreset
    ? DEFAULT_AVATARS.find(a => a.key === avatarPreset)?.src ?? null
    : null;
  const avatarSrc = src ?? presetSrc;

  // Resolve frame def
  const frameDef = FRAME_DEFS.find(f => f.key === frameKey) ?? null;
  const showFrame = frameDef !== null && (isPlus || !frameDef.plusOnly);

  const lockSize = Math.max(14, Math.round(size * 0.22));

  const FRAME_BLEED = 0.15;
  const frameSize = Math.round(size * (1 + FRAME_BLEED * 2));
  const frameOffset = -Math.round(size * FRAME_BLEED);
  const avatarInset = Math.round(size * 0.12);

  const [glimmerColor, glowColor] = FRAME_GLIMMER_COLORS[frameKey ?? ''] ?? ['#f8e8b8', '#f8e8b830'];
  const sizeScale = size / 96;

  // ── Procedural glimmer scheduler ──────────────────────────────────────────
  // Drives up to MAX_CONCURRENT glimmers at once. Each glimmer picks a random
  // anchor, size, and opacity, then animates through in/peak/out phases using
  // requestAnimationFrame. A new glimmer fires after a randomized quiet pause
  // so the pattern never repeats on a fixed rhythm.
  const MAX_CONCURRENT = 2;
  const [glimmers, setGlimmers] = useState<GlimmerState[]>([]);
  const nextId = useRef(0);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef<GlimmerState[]>([]);
  const prngRef = useRef(makePrng(Date.now() & 0xffff));

  useEffect(() => {
    if (!showFrame || prefersReduced) {
      setGlimmers([]);
      return;
    }

    const rand = prngRef.current;

    function spawnGlimmer() {
      // Pick a random anchor from the pool, avoiding the last-used one
      const anchorIdx = Math.floor(rand() * ANCHOR_POOL.length);
      const [cxPct, cyPct] = ANCHOR_POOL[anchorIdx];
      const cx = Math.round((cxPct / 100) * size);
      const cy = Math.round((cyPct / 100) * size);

      // Randomize size (2–5px scaled) and peak opacity (0.15–0.28)
      const basePx = 2 + rand() * 3;
      const s = Math.max(2, Math.round(basePx * sizeScale));
      const peakOpacity = 0.15 + rand() * 0.13;
      const glowPx = Math.max(1, Math.round(s * 0.5));

      const id = nextId.current++;
      const glimmer: GlimmerState = { id, cx, cy, s, opacity: 0, phase: 'in', glowPx };
      activeRef.current = [...activeRef.current, glimmer];
      setGlimmers([...activeRef.current]);

      // Phase durations (ms): fade-in 600–900, peak hold 200–500, fade-out 1200–2000
      const fadeIn  = 600  + rand() * 300;
      const hold    = 200  + rand() * 300;
      const fadeOut = 1200 + rand() * 800;
      const total   = fadeIn + hold + fadeOut;

      const startTime = performance.now();

      function tick(now: number) {
        const elapsed = now - startTime;
        let opacity = 0;
        let phase: GlimmerState['phase'] = 'in';

        if (elapsed < fadeIn) {
          opacity = (elapsed / fadeIn) * peakOpacity;
          phase = 'in';
        } else if (elapsed < fadeIn + hold) {
          opacity = peakOpacity;
          phase = 'peak';
        } else if (elapsed < total) {
          opacity = peakOpacity * (1 - (elapsed - fadeIn - hold) / fadeOut);
          phase = 'out';
        } else {
          opacity = 0;
          phase = 'done';
        }

        activeRef.current = activeRef.current.map(g =>
          g.id === id ? { ...g, opacity, phase } : g
        );
        setGlimmers([...activeRef.current]);

        if (phase !== 'done') {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          // Remove this glimmer and schedule the next one
          activeRef.current = activeRef.current.filter(g => g.id !== id);
          setGlimmers([...activeRef.current]);
          scheduleNext();
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    function scheduleNext() {
      // Only spawn if below the concurrent cap
      if (activeRef.current.length >= MAX_CONCURRENT) return;
      // Random quiet pause between glimmers: 800ms–3500ms
      const pause = 800 + prngRef.current() * 2700;
      schedulerRef.current = setTimeout(() => {
        spawnGlimmer();
        // Occasionally spawn a second concurrent glimmer after a short offset
        if (prngRef.current() > 0.6 && activeRef.current.length < MAX_CONCURRENT) {
          schedulerRef.current = setTimeout(spawnGlimmer, 300 + prngRef.current() * 600);
        }
      }, pause);
    }

    // Kick off with a short initial delay so the frame renders first
    schedulerRef.current = setTimeout(spawnGlimmer, 400 + prngRef.current() * 800);

    return () => {
      if (schedulerRef.current) clearTimeout(schedulerRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      activeRef.current = [];
      setGlimmers([]);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFrame, prefersReduced, size, frameKey]);

  return (
    <div
      className={`relative inline-flex shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* ── Avatar circle ── */}
      <div
        className="absolute rounded-full overflow-hidden"
        style={{ inset: avatarInset, zIndex: 1 }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={alt}
            className="w-full h-full object-cover"
            width={size}
            height={size}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: 'hsl(var(--muted))' }}
          >
            <span
              className="font-serif font-semibold select-none"
              style={{
                fontSize: Math.round(size * 0.3),
                color: 'hsl(var(--muted-foreground))',
              }}
            >
              ✦
            </span>
          </div>
        )}
      </div>

      {/* ── Frame overlay ── */}
      {showFrame && (
        <>
          {/* Frame PNG — centred, allowed to bleed beyond the avatar circle */}
          <img
            src={frameDef.src}
            alt=""
            aria-hidden="true"
            className="absolute pointer-events-none select-none"
            style={{
              width: frameSize,
              height: frameSize,
              top: frameOffset,
              left: frameOffset,
              objectFit: 'contain',
              zIndex: 2,
            }}
            width={frameSize}
            height={frameSize}
          />

          {/* ── Procedurally-timed glimmers ── */}
          {prefersReduced ? (
            // Reduced-motion: two static faint glints, no animation
            ANCHOR_POOL.slice(0, 2).map(([cxPct, cyPct], i) => {
              const s = Math.max(2, Math.round(3 * sizeScale));
              const cx2 = Math.round((cxPct / 100) * size);
              const cy2 = Math.round((cyPct / 100) * size);
              return (
                <svg
                  key={i}
                  aria-hidden="true"
                  className="absolute pointer-events-none"
                  style={{ left: cx2 - s, top: cy2 - s, width: s * 2, height: s * 2, zIndex: 3, opacity: 0.10 }}
                  viewBox={`${-s} ${-s} ${s * 2} ${s * 2}`}
                  overflow="visible"
                >
                  <path d={flarePath(s)} fill={glimmerColor} />
                </svg>
              );
            })
          ) : (
            glimmers.map(g => (
              <svg
                key={g.id}
                aria-hidden="true"
                className="absolute pointer-events-none"
                style={{
                  left: g.cx - g.s,
                  top: g.cy - g.s,
                  width: g.s * 2,
                  height: g.s * 2,
                  zIndex: 3,
                  overflow: 'visible',
                  opacity: g.opacity,
                  filter: `drop-shadow(0 0 ${g.glowPx}px ${glowColor})`,
                  willChange: 'opacity',
                }}
                viewBox={`${-g.s} ${-g.s} ${g.s * 2} ${g.s * 2}`}
                overflow="visible"
              >
                <path d={flarePath(g.s)} fill={glimmerColor} />
              </svg>
            ))
          )}
        </>
      )}

      {/* ── Lock badge (picker only, non-Plus) ── */}
      {showLock && !isPlus && frameDef?.plusOnly && (
        <div
          className="absolute bottom-0 right-0 rounded-full flex items-center justify-center"
          style={{
            width: lockSize,
            height: lockSize,
            background: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            zIndex: 5,
          }}
        >
          <Lock
            style={{
              width: lockSize * 0.55,
              height: lockSize * 0.55,
              color: 'hsl(var(--primary))',
            }}
          />
        </div>
      )}
    </div>
  );
}
