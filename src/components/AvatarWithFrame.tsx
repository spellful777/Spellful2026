/**
 * AvatarWithFrame — shared component used by Profile Studio AND the live
 * /u/[username] public profile. Renders a circular avatar with an optional
 * CSS-generated color frame ring.
 *
 * Frames are pure CSS — no images, no Plus gating. Each frame is a named
 * color option rendered as a layered border/shadow ring around the avatar.
 * Colors are defined as CSS variables in src/styles/globals.css.
 *
 * Props:
 *   src          — uploaded avatar URL (takes priority over preset)
 *   avatarPreset — key for a default witch-hat avatar slot
 *   frameKey     — one of the FRAME_DEFS keys, or '' for none
 *   size         — diameter in px (default 96)
 *   alt          — alt text for the avatar image
 *   className    — extra classes on the outer wrapper
 */

// ─── Frame catalogue ──────────────────────────────────────────────────────────
// 15 color options, all rendered with CSS variables. No images, no Plus gating.
// Keys are stored in user.avatarFrame in the DB.

export type FrameKey =
  | ''
  | 'obsidian'
  | 'amethyst'
  | 'lunar'
  | 'emerald'
  | 'sapphire'
  | 'crimson'
  | 'golden'
  | 'rose-quartz'
  | 'smoky'
  | 'aurora'
  | 'violet'
  | 'ivory'
  | 'copper'
  | 'jade'
  | 'astral';

export type FrameDef = {
  key: FrameKey;
  label: string;
  /** CSS variable name for the primary ring color (without --) */
  cssVar: string;
  /** CSS variable name for the inner highlight color (without --) */
  highlightVar: string;
};

export const FRAME_DEFS: FrameDef[] = [
  { key: 'obsidian',    label: 'Midnight Obsidian',  cssVar: 'frame-obsidian',    highlightVar: 'frame-obsidian-hi'    },
  { key: 'amethyst',    label: 'Amethyst Veil',      cssVar: 'frame-amethyst',    highlightVar: 'frame-amethyst-hi'    },
  { key: 'lunar',       label: 'Lunar Mist',         cssVar: 'frame-lunar',       highlightVar: 'frame-lunar-hi'       },
  { key: 'emerald',     label: 'Emerald Oracle',     cssVar: 'frame-emerald',     highlightVar: 'frame-emerald-hi'     },
  { key: 'sapphire',    label: 'Celestial Sapphire', cssVar: 'frame-sapphire',    highlightVar: 'frame-sapphire-hi'    },
  { key: 'crimson',     label: 'Crimson Ritual',     cssVar: 'frame-crimson',     highlightVar: 'frame-crimson-hi'     },
  { key: 'golden',      label: 'Golden Alchemy',     cssVar: 'frame-golden',      highlightVar: 'frame-golden-hi'      },
  { key: 'rose-quartz', label: 'Rose Quartz',        cssVar: 'frame-rose-quartz', highlightVar: 'frame-rose-quartz-hi' },
  { key: 'smoky',       label: 'Smoky Moonstone',    cssVar: 'frame-smoky',       highlightVar: 'frame-smoky-hi'       },
  { key: 'aurora',      label: 'Aurora Spirit',      cssVar: 'frame-aurora',      highlightVar: 'frame-aurora-hi'      },
  { key: 'violet',      label: 'Violet Eclipse',     cssVar: 'frame-violet',      highlightVar: 'frame-violet-hi'      },
  { key: 'ivory',       label: 'Ivory Sanctuary',    cssVar: 'frame-ivory',       highlightVar: 'frame-ivory-hi'       },
  { key: 'copper',      label: 'Copper Enchantment', cssVar: 'frame-copper',      highlightVar: 'frame-copper-hi'      },
  { key: 'jade',        label: 'Mystic Jade',        cssVar: 'frame-jade',        highlightVar: 'frame-jade-hi'        },
  { key: 'astral',      label: 'Astral Twilight',    cssVar: 'frame-astral',      highlightVar: 'frame-astral-hi'      },
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
  /** @deprecated No longer used — frames are available to all users */
  isPlus?: boolean;
  /** @deprecated No longer used — no Plus lock on frames */
  showLock?: boolean;
  alt?: string;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AvatarWithFrame({
  src,
  avatarPreset,
  frameKey = '',
  size = 96,
  // isPlus and showLock accepted but ignored — frames are free for all
  alt = 'Avatar',
  className = '',
}: AvatarWithFrameProps) {
  // Resolve avatar image source
  const presetSrc = avatarPreset
    ? DEFAULT_AVATARS.find(a => a.key === avatarPreset)?.src ?? null
    : null;
  const avatarSrc = src ?? presetSrc;

  // Resolve frame def
  const frameDef = FRAME_DEFS.find(f => f.key === frameKey) ?? null;

  // Ring thickness and gap scale with avatar size
  const ringThickness = Math.max(3, Math.round(size * 0.055));
  const gap = Math.max(2, Math.round(size * 0.03));
  const outerSize = size + (ringThickness + gap) * 2;
  const glowPx = Math.round(size * 0.12);

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: outerSize, height: outerSize }}
    >
      {/* Frame ring — CSS border + box-shadow for depth */}
      {frameDef && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `${ringThickness}px solid hsl(var(--${frameDef.cssVar}))`,
            boxShadow: [
              `inset 0 0 0 1px hsl(var(--${frameDef.highlightVar}) / 0.38)`,
              `0 0 0 1px hsl(var(--${frameDef.highlightVar}) / 0.18)`,
              `0 2px ${glowPx}px hsl(var(--${frameDef.cssVar}) / 0.5)`,
            ].join(', '),
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Avatar circle */}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          background: 'hsl(var(--muted))',
          flexShrink: 0,
          position: 'relative',
        }}
      >
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={alt}
            width={size}
            height={size}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'hsl(var(--primary) / 0.15)',
              color: 'hsl(var(--primary))',
              fontSize: Math.round(size * 0.38),
              fontFamily: 'var(--font-heading)',
              userSelect: 'none',
            }}
            aria-hidden="true"
          >
            ✦
          </div>
        )}
      </div>
    </div>
  );
}
