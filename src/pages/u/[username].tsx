/**
 * /u/:username — Immersive public member profile (Redesign v2)
 *
 * Nine content modules:
 *   1. About My Path       — bio + location
 *   2. Magical Interests   — interest tags + practice labels
 *   3. Sacred Space        — gallery grid + lightbox  (/api/profile/:u/gallery)
 *   4. Featured Posts      — pinned community posts   (/api/profile/:u/featured)
 *   5. My Coven            — coven member count + avatars
 *   6. Favorites           — collections with cover images
 *   7. Magical Soundscapes — waveform player rows     (/api/profile/:u/soundscapes)
 *   8. Guestbook           — entries + submit form    (/api/profile/:u/guestbook)
 *   9. Milestones          — vertical timeline        (/api/profile/:u/milestones)
 *
 * Visibility enforcement:
 *   - Profile-level (private/coven): API returns 403 before any data reaches the page
 *   - Field-level: canSeeField() gates bio, location, zodiac, social links client-side
 *     (server already strips values; this is a belt-and-suspenders UI guard)
 *   - Section data: each section API independently checks coven status
 *
 * Preview mode: ?preview=guest|member|blocked  (owner-only; forwarded to API)
 */
import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useParams, useNavigate, Link, useLoaderData, useSearchParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';
import {
  MapPin, Users, Lock, Check, Clock, MessageCircle,
  ExternalLink, Settings, MoreHorizontal, Share2,
  Star, Sparkles, BookOpen, Heart, Image as ImageIcon,
  Music, Scroll, Globe, FileText,
  Wand2, Layers, UserPlus, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import AvatarWithFrame from '@/components/AvatarWithFrame';
import { OnlineDot } from '@/components/OnlineDot';
import { BlockUserSheet } from '@/components/BlockUserSheet';
import { ReportModal } from '@/components/ReportModal';
import ProfileLinkShareSheet from '@/components/ProfileLinkShareSheet';
import { user_profile as pageContent } from 'virtual:content';

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  name: string | null;
  username: string | null;
  image: string | null;
  bio: string | null;
  location: string | null;
  witchPath: string | null;
  profileVisibility: string | null;
  sunSign: string | null;
  moonSign: string | null;
  risingSign: string | null;
  createdAt: string | null;
  coverImage: string | null;
  coverPreset: string | null;
  accentColor: string | null;
  pronouns: string | null;
  interestTags: string[] | null;
  socialLinks: Record<string, string> | null;
  profileTheme: string | null;
  avatarFrame: string | null;
  avatarPreset: string | null;
  practiceLabels: string[] | null;
  profileStatus: string | null;
  profileSections: { id: string; enabled: boolean; order: number }[] | null;
  hideOnlineStatus: boolean | null;
  profileLayout: string | null;
  bioVisibility: string | null;
  locationVisibility: string | null;
  zodiacVisibility: string | null;
  socialLinksVisibility: string | null;
};

type ProfileData = {
  profile: Profile;
  connectionStatus: string | null;
  connectionId: number | null;
  isOwn: boolean;
  covenCount: number;
  followerCount: number;
};

type IdentityData = {
  magicalName?: string | null;
  magicalPath?: string | null;
  personalMotto?: string | null;
  experienceLevel?: string | null;
  favoriteElement?: string | null;
};

type GalleryItem = {
  id: string;
  imageUrl: string;
  caption?: string | null;
  visibility: string;
};

type FeaturedPost = {
  id: number;
  title: string;
  createdAt: string | null;
  audience: string | null;
};

type CollectionItem = { id: string; name: string; note?: string | null };
type Collection = { id: string; name: string; coverImage?: string | null; items: CollectionItem[] };

type Milestone = {
  id: string;
  title: string;
  milestoneDate?: string | null;
  note?: string | null;
};

type Soundscape = {
  id: string;
  title: string | null;
  url: string;
  provider?: string | null;
  coverImage?: string | null;
};

type GuestbookEntry = {
  id: string;
  authorName: string | null;
  authorImage: string | null;
  authorUsername: string | null;
  content: string;
  createdAt: string;
};

type GuestbookData = {
  enabled: boolean;
  settings?: { allowedSubmitters?: string | null; visibility?: string | null };
  entries: GuestbookEntry[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const ZODIAC_SYMBOLS: Record<string, string> = {
  Aries: '♈', Taurus: '♉', Gemini: '♊', Cancer: '♋',
  Leo: '♌', Virgo: '♍', Libra: '♎', Scorpio: '♏',
  Sagittarius: '♐', Capricorn: '♑', Aquarius: '♒', Pisces: '♓',
};

const ELEMENT_ICONS: Record<string, string> = {
  Fire: '🔥', Water: '💧', Earth: '🌿', Air: '💨', Spirit: '✨', Aether: '🌌',
};

// Fallback cover images keyed by collection name (lowercase)
const COLLECTION_FALLBACKS: Record<string, string> = {
  crystals: '/airo-assets/images/dashboard/crystal-amethyst',
  herbs: '/airo-assets/images/dashboard/crystal-malachite',
  'tarot decks': '/airo-assets/images/tarot/cups/ace-of-cups',
  bookshelf: '/airo-assets/images/pages/blog/post-crystals',
  'magical tools': '/airo-assets/images/pages/home/resource-magical-things',
  inspirations: '/airo-assets/images/pages/home/resource-spells',
  spells: '/airo-assets/images/pages/home/resource-spells',
  tarot: '/airo-assets/images/pages/home/resource-tarot',
  moon: '/airo-assets/images/pages/home/resource-moon-cycles',
};

const COVER_PRESETS: Record<string, string> = {
  celestial: 'linear-gradient(135deg, hsl(248 60% 8%) 0%, hsl(270 55% 18%) 50%, hsl(248 60% 8%) 100%)',
  forest: 'linear-gradient(135deg, hsl(150 40% 8%) 0%, hsl(270 45% 14%) 60%, hsl(248 50% 10%) 100%)',
  ocean: 'linear-gradient(135deg, hsl(210 60% 8%) 0%, hsl(248 55% 16%) 60%, hsl(270 45% 10%) 100%)',
  flame: 'linear-gradient(135deg, hsl(20 60% 10%) 0%, hsl(270 50% 14%) 60%, hsl(248 50% 8%) 100%)',
  void: 'linear-gradient(135deg, hsl(248 50% 5%) 0%, hsl(260 40% 10%) 100%)',
};

// Profile theme CSS variable overrides — must match THEME_OVERRIDES in account/profile.tsx
const THEME_OVERRIDES: Record<string, CSSProperties> = {
  celestial: { '--profile-accent': 'hsl(259 39% 76%)',  '--profile-bg': 'hsl(259 39% 10%)' } as CSSProperties,
  forest:    { '--profile-accent': 'hsl(74 54% 54%)',   '--profile-bg': 'hsl(120 20% 8%)' } as CSSProperties,
  lunar:     { '--profile-accent': 'hsl(259 20% 64%)',  '--profile-bg': 'hsl(248 30% 8%)' } as CSSProperties,
  gothic:    { '--profile-accent': 'hsl(0 0% 80%)',     '--profile-bg': 'hsl(0 0% 5%)' } as CSSProperties,
  cottage:   { '--profile-accent': 'hsl(74 54% 54%)',   '--profile-bg': 'hsl(80 15% 8%)' } as CSSProperties,
  crystal:   { '--profile-accent': 'hsl(44 54% 54%)',   '--profile-bg': 'hsl(270 30% 9%)' } as CSSProperties,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function formatMilestoneDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated star field for the cover banner */
function StarField() {
  const stars = Array.from({ length: 55 }, (_, i) => ({
    id: i,
    x: (i * 37.3 + 11) % 100,
    y: (i * 53.7 + 7) % 100,
    size: (i % 3) * 0.8 + 0.6,
    opacity: ((i % 5) + 2) / 10,
    dur: 2.2 + (i % 4) * 0.7,
  }));
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {stars.map(s => (
        <motion.div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.size, height: s.size }}
          animate={{ opacity: [s.opacity, s.opacity * 0.15, s.opacity] }}
          transition={{ duration: s.dur, repeat: Infinity, ease: 'easeInOut' as const }}
        />
      ))}
    </div>
  );
}

/** Waveform decoration for soundscape rows */
function Waveform({ active = false }: { active?: boolean }) {
  const bars = [3, 7, 11, 14, 9, 5, 12, 16, 8, 4, 13, 9, 6, 11, 14, 5, 9, 12, 7, 4, 10, 8, 13, 6, 9];
  return (
    <div className="flex items-center gap-px h-5" aria-hidden="true">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-0.5 rounded-full"
          style={{ height: h, background: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.5)' }}
          animate={active ? { scaleY: [1, 1.4, 0.7, 1.2, 1] } : {}}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.04, ease: 'easeInOut' as const }}
        />
      ))}
    </div>
  );
}

/** Lightbox for Sacred Space gallery */
function Lightbox({ items, startIndex, onClose }: {
  items: GalleryItem[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIndex);
  const prev = useCallback(() => setIdx(i => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIdx(i => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, onClose]);

  const item = items[idx];
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        onClick={onClose}
        aria-label="Close lightbox"
      >
        <X className="w-5 h-5" />
      </button>
      {items.length > 1 && (
        <>
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={e => { e.stopPropagation(); prev(); }}
            aria-label="Previous photo"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={e => { e.stopPropagation(); next(); }}
            aria-label="Next photo"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      <motion.div
        key={idx}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="max-w-lg w-full"
        onClick={e => e.stopPropagation()}
      >
        <img
          src={item.imageUrl}
          alt={item.caption ?? 'Sacred space photo'}
          className="w-full rounded-2xl object-contain max-h-[70vh]"
        />
        {item.caption && (
          <p className="text-center text-white/70 text-sm mt-3">{item.caption}</p>
        )}
        {items.length > 1 && (
          <p className="text-center text-white/40 text-xs mt-1">{idx + 1} / {items.length}</p>
        )}
      </motion.div>
    </motion.div>
  );
}

/** Section card with animated entrance */
function RealmSection({ id, title, icon, children, className = '', headerRight }: {
  id?: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.38, ease: 'easeOut' as const }}
      className={`rounded-2xl border border-border bg-card p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        {headerRight}
      </div>
      {children}
    </motion.section>
  );
}

/** Social platform SVG icon */
function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  if (p === 'instagram') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
  if (p === 'tiktok') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
    </svg>
  );
  if (p === 'youtube') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
  if (p === 'x' || p === 'twitter') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
  if (p === 'facebook') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
  if (p === 'spotify') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
    </svg>
  );
  if (p === 'threads') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.829.848 4.367-1.386 6.51C17.7 22.761 15.458 23.96 12.186 24z"/>
    </svg>
  );
  if (p === 'tumblr') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M14.563 24c-5.093 0-7.031-3.756-7.031-6.411V9.747H5.116V6.648c3.63-1.313 4.512-4.596 4.71-6.469C9.84.051 9.941 0 9.999 0h3.517v6.114h4.801v3.633h-4.82v7.47c.016 1.001.375 2.371 2.207 2.371h.09c.631-.02 1.486-.205 1.936-.419l1.156 3.425c-.436.636-2.4 1.374-4.306 1.406z"/>
    </svg>
  );
  if (p === 'pinterest') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/>
    </svg>
  );
  return <Globe className="w-5 h-5" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const loaderData = useLoaderData() as { seoProfile: { name?: string | null; username?: string | null; bio?: string | null } | null } | null;
  const [searchParams] = useSearchParams();
  const previewMode = searchParams.get('preview');

  // Core profile
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [identity, setIdentity] = useState<IdentityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Section data
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [featuredPosts, setFeaturedPosts] = useState<FeaturedPost[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [soundscapes, setSoundscapes] = useState<Soundscape[]>([]);
  const [guestbook, setGuestbook] = useState<GuestbookData | null>(null);

  // UI state
  const [covenActionLoading, setCovenActionLoading] = useState(false);
  const [guestbookText, setGuestbookText] = useState('');
  const [guestbookSubmitting, setGuestbookSubmitting] = useState(false);
  const [guestbookSuccess, setGuestbookSuccess] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeSoundscape, setActiveSoundscape] = useState<string | null>(null);
  const [showBlockSheet, setShowBlockSheet] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const viewerId = session?.user?.id ?? null;

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch all profile data in parallel
  useEffect(() => {
    if (!username) return;
    setLoading(true);
    setError(null);
    const u = encodeURIComponent(username);
    const pq = previewMode ? `?preview=${previewMode}` : '';

    Promise.all([
      fetch(`/api/profile/${u}${pq}`).then(r => r.json()),
      fetch(`/api/profile/${u}/identity`).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/gallery`).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/featured`).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/collections`).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/milestones`).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/soundscapes`).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/guestbook`).then(r => r.ok ? r.json() : null),
    ]).then(([pd, id, gal, feat, col, mil, snd, gb]) => {
      if (pd?.error) { setError(pd.error); setLoading(false); return; }
      setProfileData(pd);
      setIdentity(id?.identity ?? null);
      setGallery(gal?.items ?? []);
      setFeaturedPosts(feat?.posts ?? []);
      setCollections(col?.collections ?? []);
      setMilestones(mil?.milestones ?? []);
      setSoundscapes(snd?.soundscapes ?? []);
      setGuestbook(gb ?? null);
      setLoading(false);
    }).catch(() => { setError('Failed to load profile'); setLoading(false); });
  }, [username, previewMode, viewerId]);

  // Coven invite / accept / cancel
  async function handleCovenAction() {
    if (!profileData || covenActionLoading) return;
    setCovenActionLoading(true);
    const { connectionStatus, connectionId, profile } = profileData;
    try {
      if (!connectionStatus) {
        const r = await fetch('/api/coven/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ receiverId: profile.id }) });
        if (r.ok) setProfileData(prev => prev ? { ...prev, connectionStatus: 'pending_sent' } : prev);
      } else if (connectionStatus === 'pending_sent' && connectionId) {
        const r = await fetch(`/api/coven/invite/${connectionId}`, { method: 'DELETE' });
        if (r.ok) setProfileData(prev => prev ? { ...prev, connectionStatus: null, connectionId: null } : prev);
      } else if (connectionStatus === 'pending_received' && connectionId) {
        const r = await fetch(`/api/coven/invite/${connectionId}/accept`, { method: 'POST' });
        if (r.ok) setProfileData(prev => prev ? { ...prev, connectionStatus: 'accepted' } : prev);
      }
    } finally {
      setCovenActionLoading(false);
    }
  }

  // Guestbook submit
  async function handleGuestbookSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestbookText.trim() || !username) return;
    setGuestbookSubmitting(true);
    try {
      const r = await fetch(`/api/profile/${encodeURIComponent(username)}/guestbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: guestbookText.trim() }),
      });
      if (r.ok) { setGuestbookSuccess(true); setGuestbookText(''); }
    } finally {
      setGuestbookSubmitting(false);
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' as const }}>
            <Sparkles className="w-8 h-8 text-primary" />
          </motion.div>
          <p className="text-muted-foreground text-sm">{pageContent.enteringRealmText}</p>
        </div>
      </main>
    );
  }

  // ── Error / access-denied state ─────────────────────────────────────────────
  if (error || !profileData) {
    const isPrivate = error === 'This profile is private';
    const isCovenOnly = error === 'This profile is coven-only';
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Lock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-foreground mb-2">
            {isPrivate ? pageContent.privateTitle : isCovenOnly ? pageContent.covenOnlyTitle : pageContent.notFoundTitle}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {isPrivate ? pageContent.privateDesc : isCovenOnly ? pageContent.covenOnlyDesc : pageContent.notFoundDesc}
          </p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go Back</Button>
        </div>
      </main>
    );
  }

  const { profile, connectionStatus, isOwn, covenCount, followerCount } = profileData;
  const isCovenMember = connectionStatus === 'accepted';

  // Field-level visibility guard (belt-and-suspenders; server already strips values)
  function canSeeField(vis: string | null | undefined): boolean {
    if (!vis || vis === 'public') return true;
    if (vis === 'coven') return isOwn || isCovenMember;
    if (vis === 'private') return isOwn;
    return true;
  }

  const displayName = profile.name ?? profile.username ?? 'Witch';
  const firstName = displayName.split(' ')[0];
  const handle = profile.username ? `@${profile.username}` : '';
  const showBio = canSeeField(profile.bioVisibility) && !!profile.bio;
  const showLocation = canSeeField(profile.locationVisibility) && !!profile.location;
  const showZodiac = canSeeField(profile.zodiacVisibility) && (!!profile.sunSign || !!profile.moonSign || !!profile.risingSign);
  const showSocialLinks = canSeeField(profile.socialLinksVisibility) && !!profile.socialLinks && Object.keys(profile.socialLinks).length > 0;

  const coverStyle: React.CSSProperties = profile.coverImage
    ? { backgroundImage: `url(${profile.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: COVER_PRESETS[profile.coverPreset ?? 'celestial'] ?? COVER_PRESETS.celestial };

  // Section navigator tiles — only show tiles for sections that have data
  const sectionTiles = [
    { id: 'about-path',     label: 'About\nMy Path',       icon: <BookOpen className="w-5 h-5" />,  show: showBio || !!identity },
    { id: 'interests',      label: 'Magical\nInterests',    icon: <Sparkles className="w-5 h-5" />,  show: (profile.interestTags?.length ?? 0) > 0 || (profile.practiceLabels?.length ?? 0) > 0 },
    { id: 'sacred-space',   label: 'Sacred\nSpace',         icon: <ImageIcon className="w-5 h-5" />, show: gallery.length > 0 },
    { id: 'featured-posts', label: 'Featured\nPosts',       icon: <FileText className="w-5 h-5" />,  show: featuredPosts.length > 0 },
    { id: 'my-coven',       label: 'My\nCoven',             icon: <Users className="w-5 h-5" />,     show: covenCount > 0 },
    { id: 'favorites',      label: 'Favorites',             icon: <Heart className="w-5 h-5" />,     show: collections.length > 0 },
    { id: 'soundscapes',    label: 'Magical\nSoundscapes',  icon: <Music className="w-5 h-5" />,     show: soundscapes.length > 0 },
    { id: 'guestbook',      label: 'Guestbook',             icon: <Scroll className="w-5 h-5" />,    show: guestbook?.enabled === true },
    { id: 'milestones',     label: 'Milestones',            icon: <Star className="w-5 h-5" />,      show: milestones.length > 0 },
  ].filter(t => t.show);

  const seoName = loaderData?.seoProfile?.name ?? displayName;
  const seoBio = loaderData?.seoProfile?.bio ?? '';
  const seoUrl = `https://spellful.com/u/${username}`;

  return (
    <>
      <Helmet>
        <title>{seoName} — Spellful</title>
        <meta name="description" content={seoBio ? seoBio.slice(0, 155) : `Visit ${seoName}'s magical realm on Spellful.`} />
        <meta property="og:title" content={`${seoName} on Spellful`} />
        <meta property="og:description" content={seoBio ? seoBio.slice(0, 155) : `Visit ${seoName}'s magical realm on Spellful.`} />
        <meta property="og:url" content={seoUrl} />
        <meta property="og:type" content="profile" />
        {profile.image && <meta property="og:image" content={profile.image} />}
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <main className="min-h-screen pb-24" style={{ backgroundColor: (THEME_OVERRIDES[profile.profileTheme ?? ''] as Record<string,string> | undefined)?.['--profile-bg'] ?? 'hsl(var(--background))', ...THEME_OVERRIDES[profile.profileTheme ?? ''] }}>

        {/* ══════════════════════════════════════════════════════════════════
            REALM HERO — cover banner + star field + avatar + identity
        ══════════════════════════════════════════════════════════════════ */}
        <div className="relative w-full">
          {/* Cover banner */}
          <div className="w-full h-52 md:h-64 relative" style={coverStyle}>
            <StarField />
            <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/85 pointer-events-none" />
          </div>

          {/* Top action bar */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-safe-top pt-4 z-10">
            <button
              onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm"
              aria-label="Go back"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowShareSheet(true)}
                className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm"
                aria-label="Share profile"
              >
                <Share2 className="w-4 h-4" />
              </button>
              {isOwn && (
                <Link
                  to="/account/profile"
                  className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm"
                  aria-label="Edit profile"
                >
                  <Settings className="w-4 h-4" />
                </Link>
              )}
              {!isOwn && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(v => !v)}
                    className="w-9 h-9 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-sm"
                    aria-label="More options"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  <AnimatePresence>
                    {showMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -4 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -4 }}
                        transition={{ duration: 0.15 }}
                        className="absolute right-0 top-11 w-44 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden"
                      >
                        <button
                          onClick={() => { setShowReportModal(true); setShowMenu(false); }}
                          className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-muted transition-colors"
                        >
                          Report
                        </button>
                        {viewerId && (
                          <button
                            onClick={() => { setShowBlockSheet(true); setShowMenu(false); }}
                            className="w-full text-left px-4 py-3 text-sm text-destructive hover:bg-muted transition-colors"
                          >
                            Block
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>

          {/* Avatar + name — overlaps cover bottom */}
          <div className="px-4 -mt-16 relative z-10">
            <div className="flex items-end gap-3 mb-3">
              {/* Avatar with frame — shared AvatarWithFrame component */}
              <div className="relative shrink-0">
                <AvatarWithFrame
                  src={profile.image}
                  avatarPreset={profile.avatarPreset ?? undefined}
                  frameKey={profile.avatarFrame ?? ''}
                  size={96}
                  isPlus={isCovenMember || isOwn}
                  accentKey={profile.accentColor ?? 'gold'}
                  alt={displayName}
                />
                {!profile.hideOnlineStatus && (
                  <div className="absolute bottom-1 right-1" style={{ zIndex: 4 }}>
                    <OnlineDot userId={profile.id} />
                  </div>
                )}
              </div>

              {/* Name + handle + pronouns */}
              <div className="pb-1 min-w-0 flex-1">
                <h1 className="text-2xl font-bold text-foreground leading-tight">{displayName}</h1>
                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                  {handle && <span className="text-muted-foreground text-sm">{handle}</span>}
                  {profile.pronouns && <span className="text-muted-foreground text-sm">· {profile.pronouns}</span>}
                </div>
              </div>
            </div>

            {/* Status / motto */}
            {profile.profileStatus && (
              <p className="text-sm italic mb-3 flex items-center gap-1.5 text-accent-foreground/80">
                <span className="text-primary">🌙</span>
                <span>{profile.profileStatus}</span>
                <span className="text-primary">✨</span>
              </p>
            )}

            {/* Coven + follower count pills */}
            {(covenCount > 0 || followerCount > 0) && (
              <div className="flex items-center gap-3 text-muted-foreground text-xs mb-3 flex-wrap">
                {followerCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5" />
                    <span><strong className="text-foreground">{followerCount}</strong> {followerCount === 1 ? 'follower' : 'followers'}</span>
                  </div>
                )}
                {covenCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span><strong className="text-foreground">{covenCount}</strong> coven {covenCount === 1 ? 'member' : 'members'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            {!isOwn && viewerId && (
              <div className="flex gap-2 mb-1 flex-wrap">
                <Button size="sm" className="flex-1 min-w-0 text-xs font-semibold" onClick={handleCovenAction} disabled={covenActionLoading}>
                  {connectionStatus === 'accepted'
                    ? <><Check className="w-3.5 h-3.5 mr-1" />In Coven</>
                    : connectionStatus === 'pending_sent'
                    ? <><Clock className="w-3.5 h-3.5 mr-1" />Invited</>
                    : connectionStatus === 'pending_received'
                    ? <><Users className="w-3.5 h-3.5 mr-1" />Accept</>
                    : <><UserPlus className="w-3.5 h-3.5 mr-1" />Follow</>}
                </Button>
                <Button size="sm" variant="outline" className="flex-1 min-w-0 text-xs" onClick={() => navigate(`/messages?user=${profile.id}`)}>
                  <MessageCircle className="w-3.5 h-3.5 mr-1" />Message
                </Button>
                {connectionStatus !== 'accepted' && (
                  <Button size="sm" variant="outline" className="flex-1 min-w-0 text-xs" onClick={handleCovenAction} disabled={covenActionLoading}>
                    <Users className="w-3.5 h-3.5 mr-1" />Invite to Coven
                  </Button>
                )}
              </div>
            )}
            {!isOwn && !viewerId && (
              <div className="flex gap-2 mb-1">
                <Button size="sm" className="flex-1 text-xs" onClick={() => navigate('/login')}>
                  {pageContent.signInCta}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            CONTENT MODULES
        ══════════════════════════════════════════════════════════════════ */}
        <div className="px-4 space-y-3 mt-3">

          {/* ── Astrology signature row ──────────────────────────────────── */}
          {showZodiac && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-border bg-card px-2 py-3"
            >
              <div className="grid grid-cols-3 divide-x divide-border">
                {[
                  { label: 'Sun', value: profile.sunSign, icon: '☀️' },
                  { label: 'Moon', value: profile.moonSign, icon: '🌙' },
                  { label: 'Rising', value: profile.risingSign, icon: '↑' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex flex-col items-center gap-0.5 px-2 py-1">
                    {value ? (
                      <>
                        <span className="text-xs text-muted-foreground">{icon} {label}</span>
                        <span className="text-xs font-semibold text-foreground">{ZODIAC_SYMBOLS[value] ?? ''} {value}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground/30">—</span>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── MODULE 1 + Magical Identity ─────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* About My Path */}
            {showBio && (
              <RealmSection title="About My Path ✨" icon={<BookOpen className="w-4 h-4" />} id="about-path">
                <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
                {showLocation && (
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{profile.location}</span>
                  </div>
                )}
              </RealmSection>
            )}

            {/* Magical Identity Summary */}
            {identity && (identity.magicalName || identity.magicalPath || identity.personalMotto || identity.experienceLevel || identity.favoriteElement) && (
              <RealmSection title="My Magical Identity" icon={<Wand2 className="w-4 h-4" />}>
                <div className="space-y-2">
                  {[
                    { label: 'Magical Name', value: identity.magicalName, icon: '✨' },
                    { label: 'Witch Path', value: identity.magicalPath ?? profile.witchPath, icon: '🧙' },
                    { label: 'Personal Motto', value: identity.personalMotto, icon: '💬' },
                    { label: 'Experience Level', value: identity.experienceLevel, icon: '⭐' },
                    { label: 'Favorite Element', value: identity.favoriteElement ? `${identity.favoriteElement} ${ELEMENT_ICONS[identity.favoriteElement] ?? ''}` : null, icon: '🌿' },
                    ...(showLocation && !showBio ? [{ label: 'Location', value: profile.location, icon: '📍' }] : []),
                  ].filter(r => r.value).map(row => (
                    <div key={row.label} className="flex items-start justify-between gap-2">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <span>{row.icon}</span>{row.label}
                      </span>
                      <span className="text-xs font-semibold text-foreground text-right">{row.value}</span>
                    </div>
                  ))}
                </div>
              </RealmSection>
            )}
          </div>

          {/* ── MODULE 2 — Magical Interests ────────────────────────────── */}
          {((profile.interestTags?.length ?? 0) > 0 || (profile.practiceLabels?.length ?? 0) > 0) && (
            <RealmSection title="✦ Magical Interests" icon={<Sparkles className="w-4 h-4" />} id="interests">
              <div className="flex flex-wrap gap-2">
                {(profile.interestTags ?? []).map(tag => (
                  <span key={tag} className="px-3 py-1 rounded-full text-xs border border-primary/30 bg-primary/10 text-primary font-medium">
                    ✦ {tag}
                  </span>
                ))}
                {(profile.practiceLabels ?? []).map(label => (
                  <span key={label} className="px-3 py-1 rounded-full text-xs border border-accent/30 bg-accent/10 text-accent-foreground font-medium">
                    ◈ {label}
                  </span>
                ))}
              </div>
            </RealmSection>
          )}

          {/* ── Section Navigator ────────────────────────────────────────── */}
          {sectionTiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <span className="text-primary"><Layers className="w-4 h-4" /></span>
                ✦ Explore {firstName}{pageContent.exploreRealmLabel}
              </h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {sectionTiles.map(tile => (
                  <a
                    key={tile.id}
                    href={`#${tile.id}`}
                    onClick={e => {
                      e.preventDefault();
                      document.getElementById(tile.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/50 p-3 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="text-primary">{tile.icon}</span>
                    <span className="text-xs text-foreground leading-tight whitespace-pre-line">{tile.label}</span>
                  </a>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── MODULE 3 — Sacred Space (gallery + lightbox) ─────────────── */}
          {gallery.length > 0 && (
            <RealmSection title="🌿 Sacred Space" icon={<ImageIcon className="w-4 h-4" />} id="sacred-space">
              <div className="grid grid-cols-3 gap-1.5">
                {gallery.slice(0, 9).map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => setLightboxIndex(i)}
                    className="aspect-square rounded-xl overflow-hidden relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={item.caption ?? `Sacred space photo ${i + 1}`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.caption ?? ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    {item.caption && (
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                        <p className="text-white text-xs leading-tight line-clamp-2">{item.caption}</p>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {gallery.length > 9 && (
                <p className="text-xs text-muted-foreground text-center mt-2">+{gallery.length - 9} more photos</p>
              )}
            </RealmSection>
          )}

          {/* ── MODULE 4 — Featured Posts ────────────────────────────────── */}
          {featuredPosts.length > 0 && (
            <RealmSection title="📌 Featured Posts" icon={<FileText className="w-4 h-4" />} id="featured-posts">
              <div className="space-y-2">
                {featuredPosts.slice(0, 4).map(post => (
                  <Link
                    key={post.id}
                    to={`/community/post/${post.id}`}
                    className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5 hover:border-primary/40 hover:bg-primary/5 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{post.title}</p>
                      {post.createdAt && (
                        <p className="text-xs text-muted-foreground">{getTimeAgo(post.createdAt)}</p>
                      )}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </RealmSection>
          )}

          {/* ── MODULE 5 — My Coven ──────────────────────────────────────── */}
          {covenCount > 0 && (
            <RealmSection title="🌙 My Coven" icon={<Users className="w-4 h-4" />} id="my-coven">
              <div className="flex items-center gap-3">
                <div className="flex -space-x-2">
                  {/* Placeholder avatars — real avatars would come from a coven members API */}
                  {Array.from({ length: Math.min(covenCount, 5) }, (_, i) => (
                    <div
                      key={i}
                      className="w-9 h-9 rounded-full border-2 border-card bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center"
                    >
                      <Wand2 className="w-3.5 h-3.5 text-primary" />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {covenCount} {covenCount === 1 ? 'member' : 'members'} in coven
                </p>
              </div>
            </RealmSection>
          )}

          {/* ── MODULE 6 — Favorites Collections ────────────────────────── */}
          {collections.length > 0 && (
            <RealmSection title="💎 Favorites" icon={<Heart className="w-4 h-4" />} id="favorites">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {collections.map(col => {
                  const fallbackKey = col.name.toLowerCase();
                  const imgSrc = col.coverImage ?? COLLECTION_FALLBACKS[fallbackKey] ?? null;
                  return (
                    <div key={col.id} className="flex flex-col rounded-xl overflow-hidden border border-border bg-muted/40">
                      <div className="aspect-square relative overflow-hidden">
                        {imgSrc ? (
                          <img src={imgSrc} alt={col.name} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                            <Heart className="w-5 h-5 text-primary/50" />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                      </div>
                      <div className="px-1.5 py-1.5">
                        <p className="text-xs text-foreground font-medium text-center leading-tight line-clamp-2">{col.name}</p>
                        {col.items.length > 0 && (
                          <p className="text-xs text-muted-foreground text-center">{col.items.length}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </RealmSection>
          )}

          {/* ── MODULE 7 + MODULE 9 — Soundscapes + Milestones side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Magical Soundscapes */}
            {soundscapes.length > 0 && (
              <RealmSection title="🎵 Magical Soundscapes" icon={<Music className="w-4 h-4" />} id="soundscapes">
                <div className="space-y-2">
                  {soundscapes.slice(0, 4).map(s => {
                    const isActive = activeSoundscape === s.id;
                    return (
                      <a
                        key={s.id}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onMouseEnter={() => setActiveSoundscape(s.id)}
                        onMouseLeave={() => setActiveSoundscape(null)}
                        className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3 hover:border-primary/40 transition-colors group"
                      >
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center shrink-0">
                          {s.coverImage ? (
                            <img src={s.coverImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Music className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-foreground truncate mb-1">{s.title ?? 'Playlist'}</p>
                          <Waveform active={isActive} />
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                      </a>
                    );
                  })}
                </div>
              </RealmSection>
            )}

            {/* Milestones */}
            {milestones.length > 0 && (
              <RealmSection title="✦ Milestones" icon={<Star className="w-4 h-4" />} id="milestones">
                <div>
                  {milestones.slice(0, 6).map((m, i) => (
                    <div key={m.id} className="flex items-start gap-3">
                      <div className="flex flex-col items-center pt-1.5 shrink-0">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        {i < Math.min(milestones.length, 6) - 1 && (
                          <div className="w-px bg-border mt-1" style={{ height: 28 }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground leading-tight">{m.title}</p>
                          {m.milestoneDate && (
                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">{formatMilestoneDate(m.milestoneDate)}</span>
                          )}
                        </div>
                        {m.note && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{m.note}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </RealmSection>
            )}
          </div>

          {/* ── MODULE 8 + Social Links side by side ────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Guestbook */}
            {guestbook?.enabled && (
              <RealmSection
                title="🍃 Guestbook"
                icon={<Scroll className="w-4 h-4" />}
                id="guestbook"
                headerRight={
                  (guestbook.entries?.length ?? 0) > 3
                    ? <span className="text-xs text-primary cursor-pointer">View all →</span>
                    : undefined
                }
              >
                {/* Entries */}
                {(guestbook.entries?.length ?? 0) > 0 && (
                  <div className="space-y-3 mb-3">
                    {guestbook.entries.slice(0, 3).map(entry => (
                      <div key={entry.id} className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted overflow-hidden shrink-0">
                          {entry.authorImage ? (
                            <img src={entry.authorImage} alt={entry.authorName ?? ''} className="w-full h-full object-cover" width={28} height={28} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Wand2 className="w-3 h-3 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-semibold text-foreground">{entry.authorName ?? 'Anonymous'}</span>
                            <span className="text-xs text-muted-foreground">· {getTimeAgo(entry.createdAt)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{entry.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Submit form */}
                {viewerId && !isOwn && !guestbookSuccess && (() => {
                  const allowed = guestbook.settings?.allowedSubmitters ?? 'members';
                  const canSubmit = allowed === 'members' || (allowed === 'coven' && isCovenMember);
                  return canSubmit ? (
                    <form onSubmit={handleGuestbookSubmit} className="space-y-2">
                      <textarea
                        value={guestbookText}
                        onChange={e => setGuestbookText(e.target.value)}
                        placeholder={pageContent.leaveNotePlaceholder}
                        rows={2}
                        maxLength={500}
                        className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
                      />
                      <Button type="submit" size="sm" disabled={guestbookSubmitting || !guestbookText.trim()} className="w-full">
                        {guestbookSubmitting ? pageContent.sendingText : pageContent.leaveNoteButton}
                      </Button>
                    </form>
                  ) : null;
                })()}

                {guestbookSuccess && (
                  <p className="text-xs text-success flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>{pageContent.noteSuccessText}</span>
                  </p>
                )}

                {(guestbook.entries?.length ?? 0) === 0 && !viewerId && (
                  <p className="text-xs text-muted-foreground">{pageContent.noEntriesText}</p>
                )}
              </RealmSection>
            )}

            {/* Social Links */}
            {showSocialLinks && profile.socialLinks && (
              <RealmSection title="🔗 Find Me Elsewhere" icon={<Globe className="w-4 h-4" />} id="social-links">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {Object.entries(profile.socialLinks).filter(([, v]) => v).map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url.startsWith('http') ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-muted/40 p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
                    >
                      <span className="text-foreground"><SocialIcon platform={platform} /></span>
                      <span className="text-xs text-muted-foreground capitalize">{platform}</span>
                    </a>
                  ))}
                </div>
              </RealmSection>
            )}
          </div>

          {/* Member since footer */}
          {profile.createdAt && (
            <p className="text-center text-xs text-muted-foreground py-2">
              ✦ {pageContent.memberSincePrefix} {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} ✦
            </p>
          )}
        </div>
      </main>

      {/* ── Lightbox ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            items={gallery}
            startIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Modals ───────────────────────────────────────────────────────── */}
      {showBlockSheet && profile && (
        <BlockUserSheet
          open={showBlockSheet}
          onOpenChange={setShowBlockSheet}
          userId={profile.id}
          displayName={profile.name ?? profile.username ?? 'this member'}
          onBlocked={() => navigate('/')}
        />
      )}
      {showReportModal && profile && (
        <ReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetType="profile"
          targetId={profile.id}
        />
      )}
      {showShareSheet && username && (
        <ProfileLinkShareSheet
          open={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          username={username}
          displayName={displayName}
        />
      )}
    </>
  );
}
