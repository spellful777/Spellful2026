import { findTopic, topicPath } from '@/lib/spark-topics';
import { ProfileActivity, type ProfileTab } from '@/components/ProfileActivity';
import { ACCENTS } from '@/lib/profile-look';
import type { ProfileFeature } from '@/lib/profile-feature';
import { ChevronDown, Bookmark, Bell } from 'lucide-react';
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
import { uploadedMediaUrl } from '@/lib/native-api';
import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';
import { useParams, useNavigate, Link, useLoaderData, useSearchParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import { useSocialSummary } from '@/hooks/useSocialSummary';
import { COMMUNITY_REQUESTS, COMMUNITY_CONNECTIONS } from '@/lib/community-navigation';
import { useSession } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';
import {
  MapPin, Users, Lock, Check,
  ExternalLink, MoreHorizontal, Share2,
  Star, Sparkles, BookOpen, Heart, Image as ImageIcon,
  Music, Scroll, Globe, FileText,
  Wand2, UserPlus, X, ChevronLeft, ChevronRight,
} from 'lucide-react';
import AvatarWithFrame from '@/components/AvatarWithFrame';
import { OnlineDot } from '@/components/OnlineDot';
import { BlockUserSheet } from '@/components/BlockUserSheet';
import { ReportModal } from '@/components/ReportModal';
import ProfileFollowingDialog from '@/components/ProfileFollowingDialog';
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
  featuredAbout?: ProfileFeature | null;
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
  followingCount?: number;
  isFollowing: boolean;
  canViewFollowing: boolean;
  canRequestCoven: boolean;
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
  description?: string | null;
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

const DEFAULT_COVER = '/airo-assets/images/profile-covers/spellful-default';

const COVER_PRESET_IMAGES: Record<string, string> = {
  'spellful-default': DEFAULT_COVER,
  midnight: '/airo-assets/images/profile-covers/midnight',
  aurora:   '/airo-assets/images/profile-covers/aurora',
  ember:    '/airo-assets/images/profile-covers/ember',
  forest:   '/airo-assets/images/profile-covers/forest',
  cosmos:   '/airo-assets/images/profile-covers/cosmos',
  rose:     '/airo-assets/images/profile-covers/rose-mist',
  // legacy keys — fall back to spellful-default
  celestial: DEFAULT_COVER,
  ocean:     '/airo-assets/images/profile-covers/cosmos',
  flame:     '/airo-assets/images/profile-covers/ember',
  void:      DEFAULT_COVER,
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
          src={uploadedMediaUrl(item.imageUrl)}
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
function RealmSection({ children }: { id?: string; title: string; icon: React.ReactNode; children: React.ReactNode; headerRight?: React.ReactNode }) {
  return <div className="profile-section-content">{children}</div>;
}

// Branded Spellful social icon URLs — purple/gold circular badges
const BRANDED_SOCIAL_ICONS: Record<string, string> = {
  instagram: '/airo-assets/images/social-icons/instagram',
  threads:   '/airo-assets/images/social-icons/threads',
  x:         '/airo-assets/images/social-icons/x',
  twitter:   '/airo-assets/images/social-icons/x',
  facebook:  '/airo-assets/images/social-icons/facebook',
  youtube:   '/airo-assets/images/social-icons/youtube',
  spotify:   '/airo-assets/images/social-icons/spotify',
  website:   '/airo-assets/images/social-icons/website',
};

/** Social platform icon — branded image for known platforms, SVG fallback for others */
function SocialIcon({ platform }: { platform: string }) {
  const p = platform.toLowerCase();
  const brandedUrl = BRANDED_SOCIAL_ICONS[p];
  if (brandedUrl) {
    return (
      <img
        src={brandedUrl}
        alt={platform}
        className="w-9 h-9 object-contain"
        loading="lazy"
      />
    );
  }
  // SVG fallbacks for platforms without a branded icon
  if (p === 'tiktok') return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.76a4.85 4.85 0 01-1.01-.07z"/>
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
  // Generic website globe fallback
  return <Globe className="w-5 h-5" />;
}

// ─── Main page ────────────────────────────────────────────────────────────────

function ProfileRequests() {
  const summary = useSocialSummary();
  return (
    <Link to={COMMUNITY_REQUESTS} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground hover:text-primary focus-visible:outline focus-visible:outline-primary">
      <Bell className="size-4" /> Requests {Boolean(summary?.pendingRequests) && <strong className="profile-request-badge">{summary?.pendingRequests}</strong>}
    </Link>
  );
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { data: session } = useSession();
  const loaderData = useLoaderData() as { seoProfile: { name?: string | null; username?: string | null; bio?: string | null } | null } | null;
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const tab: ProfileTab = requestedTab === 'replies' || requestedTab === 'media' || requestedTab === 'about' ? requestedTab : 'sparks';
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [bioClipped, setBioClipped] = useState(false);
  const bioRef = useRef<HTMLParagraphElement>(null);
  function openTab(next: ProfileTab, section?: string) {
    const params = new URLSearchParams(searchParams);
    if (next === 'sparks') params.delete('tab');
    else params.set('tab', next);
    if (section) setOpenSection(section);
    setSearchParams(params, { preventScrollReset: true });
  }
  const previewMode = searchParams.get('preview');

  useEffect(() => {
    const bio = bioRef.current;
    if (!bio || bioExpanded) return;
    const measure = () => setBioClipped(bio.scrollHeight > bio.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bio);
    return () => observer.disconnect();
  });

  // Core profile
  const [audienceVersion, setAudienceVersion] = useState(0);
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
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState('');
  const [covenError, setCovenError] = useState('');
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
  const profileUrl = username ? `/api/profile/${encodeURIComponent(username)}` : '';

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
    setFollowError('');
    setCovenError('');
    const controller = new AbortController();
    const { signal } = controller;
    const u = encodeURIComponent(username);
    const pq = previewMode ? `?preview=${encodeURIComponent(previewMode)}` : '';

    Promise.all([
      fetch(`/api/profile/${u}${pq}`, { signal }).then(r => r.json()),
      fetch(`/api/profile/${u}/identity${pq}`, { signal }).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/gallery${pq}`, { signal }).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/featured${pq}`, { signal }).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/collections${pq}`, { signal }).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/milestones${pq}`, { signal }).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/soundscapes${pq}`, { signal }).then(r => r.ok ? r.json() : null),
      fetch(`/api/profile/${u}/guestbook${pq}`, { signal }).then(r => r.ok ? r.json() : null),
    ]).then(([pd, id, gal, feat, col, mil, snd, gb]) => {
      if (signal.aborted) return;
      if (pd?.error) { setError(pd.error); setLoading(false); return; }
      setProfileData(pd);
      const identityFields = Object.fromEntries((id?.fields ?? []).map((field: { fieldKey: string; value: string }) => [field.fieldKey, field.value]));
      setIdentity(id?.identity ?? {
        magicalName: identityFields.magical_name, magicalPath: identityFields.magical_path,
        personalMotto: identityFields.personal_motto, experienceLevel: identityFields.experience_level,
        favoriteElement: identityFields.favorite_element,
      });
      setGallery(gal?.items ?? []);
      setFeaturedPosts(feat?.posts ?? []);
      setCollections((col?.collections ?? []).map((item: Collection & { title?: string }) => ({ ...item, name: item.name ?? item.title ?? "Collection" })));
      setMilestones(mil?.milestones ?? []);
      setSoundscapes((snd?.playlists ?? snd?.soundscapes ?? []).map((item: Soundscape & { customTitle?: string; canonicalUrl?: string }) => ({
        ...item, title: item.title || item.customTitle || 'Playlist', url: item.url || item.canonicalUrl || '',
      })));
      setGuestbook(gb ? { ...gb, entries: (gb.entries ?? []).map((entry: GuestbookEntry & { text?: string }) => ({ ...entry, content: entry.content ?? entry.text ?? "", authorName: entry.authorName ?? entry.authorUsername })) } : null);
      setLoading(false);
    }).catch(() => {
      if (!signal.aborted) { setError('Failed to load profile'); setLoading(false); }
    });
    return () => controller.abort();
  }, [username, previewMode, viewerId, audienceVersion]);

  const acceptedConnection = profileData?.connectionStatus === 'accepted';

  useEffect(() => {
    if (!profileUrl || loading || error || followLoading || covenActionLoading || previewMode) return;
    const controller = new AbortController();
    let refreshing = false;
    async function updateRelationships() {
      if (document.hidden || refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(profileUrl, { signal: controller.signal, cache: 'no-store' });
        const updated = response.ok ? await response.json() as ProfileData : null;
        if (controller.signal.aborted) return;
        if (updated) {
          if ((updated.connectionStatus === 'accepted') !== acceptedConnection) {
            setLoading(true);
            setAudienceVersion(version => version + 1);
          } else {
            setProfileData(current => current?.profile.id === updated.profile.id ? updated : current);
          }
        } else if (response.status === 403 || response.status === 404) {
          setProfileData(null);
          setError('Profile unavailable');
        }
      } catch {
        // Keep the last confirmed state while the connection is unavailable.
      } finally {
        refreshing = false;
      }
    }
    const timer = setInterval(() => { void updateRelationships(); }, 15_000);
    window.addEventListener('focus', updateRelationships);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener('focus', updateRelationships);
    };
  }, [profileUrl, viewerId, loading, error, followLoading, covenActionLoading, previewMode, acceptedConnection]);

  async function handleFollow() {
    if (!profileData || followLoading) return;
    const { profile, isFollowing } = profileData;
    setFollowLoading(true);
    setFollowError('');
    try {
      const response = await fetch('/api/community/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: profile.id, following: !isFollowing }),
      });
      if (!response.ok) throw new Error('Follow action failed');
      const { following, followersCount } = await response.json() as { following: boolean; followersCount: number };
      setProfileData(current => current?.profile.id === profile.id
        ? { ...current, isFollowing: following, followerCount: followersCount }
        : current);
    } catch {
      setFollowError(isFollowing ? 'Couldn’t unfollow. Try again.' : 'Couldn’t follow. Try again.');
    } finally {
      setFollowLoading(false);
    }
  }

  async function handleCovenAction() {
    if (!profileData || covenActionLoading) return;
    const { connectionStatus, connectionId, profile } = profileData;
    setCovenActionLoading(true);
    setCovenError('');
    const headers = { 'Content-Type': 'application/json' };
    try {
      let updated: Partial<ProfileData>;
      if (!connectionStatus) {
        const response = await fetch('/api/coven/request', {
          method: 'POST', headers, body: JSON.stringify({ receiverId: profile.id }),
        });
        if (response.status === 409) {
          const latest = await fetch(profileUrl, { cache: 'no-store' });
          if (!latest.ok) throw new Error('Could not refresh Coven request');
          const current = await latest.json() as ProfileData;
          updated = { connectionStatus: current.connectionStatus, connectionId: current.connectionId, covenCount: current.covenCount };
        } else {
          if (!response.ok) throw new Error('Could not send Coven request');
          const result = await response.json() as { connectionId: number };
          updated = { connectionStatus: 'pending_sent', connectionId: result.connectionId };
        }
      } else if (connectionStatus === 'pending_sent' && connectionId) {
        const response = await fetch(`/api/coven/${connectionId}?pending=1`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Could not cancel Coven request');
        updated = { connectionStatus: null, connectionId: null };
      } else if (connectionStatus === 'pending_received' && connectionId) {
        const response = await fetch('/api/coven/respond', {
          method: 'POST', headers, body: JSON.stringify({ connectionId, action: 'accept' }),
        });
        if (!response.ok) throw new Error('Could not accept Coven request');
        updated = { connectionStatus: 'accepted', covenCount: profileData.covenCount + 1 };
        setAudienceVersion(version => version + 1);
      } else {
        return;
      }
      setProfileData(current => current?.profile.id === profile.id ? { ...current, ...updated } : current);
    } catch {
      setCovenError('Couldn’t update the Coven request. Try again.');
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
        body: JSON.stringify({ text: guestbookText.trim() }),
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

  const { profile, connectionStatus, isOwn, covenCount, followerCount, followingCount, isFollowing, canViewFollowing, canRequestCoven } = profileData;
  const isCovenMember = connectionStatus === 'accepted';

  // Field-level visibility guard (belt-and-suspenders; server already strips values)
  function canSeeField(vis: string | null | undefined): boolean {
    if (!vis || vis === 'public') return true;
    if (vis === 'coven') return isOwn || isCovenMember;
    if (vis === 'private') return isOwn;
    return true;
  }

  const displayName = profile.name ?? profile.username ?? 'Witch';
  const handle = profile.username ? `@${profile.username}` : '';
  const showBio = canSeeField(profile.bioVisibility) && !!profile.bio;
  const showLocation = canSeeField(profile.locationVisibility) && !!profile.location;
  const showZodiac = canSeeField(profile.zodiacVisibility) && (!!profile.sunSign || !!profile.moonSign || !!profile.risingSign);
  const showSocialLinks = canSeeField(profile.socialLinksVisibility) && !!profile.socialLinks && Object.keys(profile.socialLinks).length > 0;

  const coverStyle: React.CSSProperties = profile.coverImage
    ? { backgroundImage: `url(${uploadedMediaUrl(profile.coverImage)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: `url(${COVER_PRESET_IMAGES[profile.coverPreset ?? 'spellful-default'] ?? DEFAULT_COVER})`, backgroundSize: 'cover', backgroundPosition: 'center' };

  const links = showSocialLinks ? Object.entries(profile.socialLinks ?? {}).flatMap(([platform, value]) => {
    if (!value) return [];
    try {
      const url = new URL(value.startsWith('https://') || value.startsWith('http://') ? value : 'https://' + value);
      return url.username || url.password ? [] : [{ platform, url: url.href }];
    } catch { return []; }
  }) : [];
  const renderSocial = (items: typeof links) => items.map(({ platform, url }) => <a key={platform} href={url}
    target="_blank" rel="noopener noreferrer"><SocialIcon platform={platform} /><span>{platform}</span></a>);
  const theme = THEME_OVERRIDES[profile.profileTheme ?? ''];
  const chosenAccent = ACCENTS.find(item => item.key === profile.accentColor)?.color;
  const featured = profile.featuredAbout;
  const playlist = featured?.kind === 'playlist' && (isOwn || profile.profileSections?.find(item => item.id === 'soundscapes')?.enabled !== false) ? soundscapes.find(item => Number(item.id) === featured.id && item.url) : null;
  const canInteract = !!viewerId && !previewMode;

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
        <meta property="og:image" content={profile.image ?? 'https://spellful.com/airo-assets/images/pages/profile/og-image'} />
        <meta name="twitter:image" content={profile.image ?? 'https://spellful.com/airo-assets/images/pages/profile/og-image'} />
        <meta name="twitter:card" content="summary" />
      </Helmet>

      <main className="member-profile" data-layout={profile.profileLayout}
        style={{ ...theme, ...(chosenAccent ? { '--profile-accent': chosenAccent } : {}) } as CSSProperties}>
        <header className="profile-hero">
          <div className="profile-cover" style={coverStyle}><StarField /></div>
          <div className="profile-hero-options">
            {isOwn && <button type="button" className="profile-share bg-card/70" aria-label="Share profile"
              onClick={() => setShowShareSheet(true)}><Share2 className="size-4" /></button>}
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
                        {canInteract && <button type="button" className="w-full text-left px-4 py-3 text-sm hover:bg-muted"
                          onClick={() => navigate(`/messages?user=${profile.id}`)}>Message</button>}
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
          <div className="profile-identity">
            <div className="profile-framed-avatar">
              <AvatarWithFrame src={profile.image} avatarPreset={profile.avatarPreset?.replace(/^default-/, '')}
                frameKey={profile.avatarFrame ?? ''} size={66} isPlus alt={displayName} />
              {!profile.hideOnlineStatus && !previewMode && <span className="absolute bottom-1 right-1"><OnlineDot userId={profile.id} /></span>}
            </div>
            <h1>{displayName}</h1>
            <p className="profile-handle">{handle}{profile.pronouns && <span> · {profile.pronouns}</span>}</p>
            {showBio && <div>
              <p ref={bioRef} className={bioExpanded ? 'profile-bio' : 'profile-bio line-clamp-2'}>{profile.bio}</p>
              {(bioClipped || bioExpanded) && <button type="button" className="profile-more" aria-expanded={bioExpanded}
                onClick={() => setBioExpanded(value => !value)}>{bioExpanded ? 'Less' : 'More'}</button>}
            </div>}
            <div className="profile-stats">
              {isOwn ? <Link className="profile-stat" to={COMMUNITY_CONNECTIONS}><strong>{covenCount}</strong>Coven</Link>
                : <button className="profile-stat" disabled={!covenCount} onClick={() => openTab('about', 'coven')}><strong>{covenCount}</strong>Coven</button>}
              <ProfileFollowingDialog key={profile.id + '-followers'} username={profile.username ?? username ?? ''} kind="followers" count={followerCount} preview={previewMode} />
              {canViewFollowing ? <ProfileFollowingDialog key={profile.id + '-following'} username={profile.username ?? username ?? ''} count={followingCount} preview={previewMode} />
                : <span className="profile-stat"><strong>{followingCount ?? 0}</strong>Following</span>}
            </div>
            {isOwn && <div className="profile-owner-actions">
              <Link to="/account/edit-profile">Edit profile</Link><Link className="profile-gold" to="/account/profile">Profile Studio</Link>
              <ProfileRequests /><Link to="/grimoire?sparks=saved"><Bookmark className="size-4" /> Saved</Link>
            </div>}
            {!isOwn && canInteract && (
              <>
                <div data-coven-controls className="mb-1 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={isFollowing ? 'outline' : 'default'}
                    onClick={handleFollow}
                    disabled={followLoading}
                    aria-label={isFollowing ? 'Unfollow' : 'Follow'}
                    title={isFollowing ? 'Unfollow' : 'Follow'}
                    className="min-h-10"
                  >
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                    {followLoading ? 'Saving…' : isFollowing ? 'Following' : 'Follow'}
                  </Button>
                  {connectionStatus === 'accepted' ? (
                    <span role="status" className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm">
                      <Check className="h-4 w-4" aria-hidden="true" /> In Coven
                    </span>
                  ) : connectionStatus === 'pending_sent' ? (
                    <Button size="sm" variant="outline" className="min-h-10" onClick={handleCovenAction} disabled={covenActionLoading}>
                      Requested · Cancel
                    </Button>
                  ) : connectionStatus === 'pending_received' ? (
                    <Button size="sm" variant="outline" className="min-h-10" onClick={handleCovenAction} disabled={covenActionLoading}>
                      Accept request
                    </Button>
                  ) : !connectionStatus && canRequestCoven && (
                    <Button size="sm" variant="outline" className="coven-action min-h-10" onClick={handleCovenAction} disabled={covenActionLoading}>
                      <Users className="h-4 w-4" aria-hidden="true" /> Add to Coven
                    </Button>
                  )}
                  <button type="button" className="profile-share" onClick={() => setShowShareSheet(true)} aria-label="Share profile"><Share2 className="size-4" /></button>
                </div>
                <div aria-live="polite" className="text-sm text-muted-foreground">
                  {connectionStatus === 'pending_sent' && 'Coven request sent.'}
                  {connectionStatus === 'declined' && 'Coven request declined.'}
                </div>
                {followError && <p role="alert" className="text-sm text-destructive">{followError}</p>}
                {covenError && <p role="alert" className="text-sm text-destructive">{covenError}</p>}
              </>
            )}

            {!isOwn && !viewerId && <div className="profile-visitor-actions">
              <Link className="profile-gold" to={`/login?redirect=${encodeURIComponent('/u/' + profile.username)}`}>Follow</Link>
              {canRequestCoven && <Link to={`/login?redirect=${encodeURIComponent('/u/' + profile.username)}`}>Add to Coven</Link>}
              <button type="button" className="profile-share" aria-label="Share profile" onClick={() => setShowShareSheet(true)}><Share2 className="size-4" /></button>
            </div>}
            {links.length > 0 && <div className="profile-social">{renderSocial(links.slice(0, 3))}</div>}
          </div>
        </header>
        <nav className="profile-tabs" aria-label="Profile sections">
          {(['sparks', 'replies', 'media', 'about'] as const).map(item => <button type="button" key={item}
            aria-current={tab === item ? 'page' : undefined} onClick={() => openTab(item)}>{item}</button>)}
        </nav>
        {tab !== 'about' ? <ProfileActivity key={profile.id + tab + previewMode + viewerId + audienceVersion}
          endpoint={profileUrl} tab={tab} preview={previewMode} canInteract={canInteract} /> : <div className="profile-about">
          {playlist && <div className="profile-about-feature">
            {playlist.coverImage ? <img src={playlist.coverImage} alt="" /> : <img className="profile-playlist-art" src="/airo-assets/images/pages/home/resource-moon-cycles" alt="" />}
            <div><span className="profile-feature-label">Featured playlist</span><strong>{playlist.title}</strong>
              {playlist.description && <small>{playlist.description}</small>}</div>
            <a href={playlist.url} target="_blank" rel="noopener noreferrer">Open</a>
          </div>}
          {featured?.kind === 'link' && <div className="profile-about-feature"><Globe className="size-5" /><div><strong>{featured.title}</strong></div><a href={featured.url} target="_blank" rel="noopener noreferrer">Open</a></div>}
          {featured?.kind === 'spark' && <div className="profile-about-feature"><Sparkles className="size-5" /><div><strong>Featured Spark</strong></div><Link to={'/community/post/' + featured.id}>Open</Link></div>}
          {[
{ id: 'about', title: 'About My Path', show: showBio || showLocation || showZodiac || !!profile.profileStatus || !!profile.witchPath || !!(identity && Object.values(identity).some(Boolean)), body: <>
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
            {(showBio || showLocation || profile.profileStatus || profile.witchPath) && (
              <RealmSection title="About My Path ✨" icon={<BookOpen className="w-4 h-4" />} id="about-path">
                <p className="text-sm text-muted-foreground leading-relaxed">{showBio ? profile.bio : null}</p>
                {profile.profileStatus && <p>{profile.profileStatus}</p>}
                {profile.witchPath && <p>{profile.witchPath}</p>}
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


</> },
{ id: 'interests', title: 'Magical Interests', show: (profile.interestTags?.length ?? 0) + (profile.practiceLabels?.length ?? 0) > 0, body: <>
          {/* ── MODULE 2 — Magical Interests ────────────────────────────── */}
          {((profile.interestTags?.length ?? 0) > 0 || (profile.practiceLabels?.length ?? 0) > 0) && (
            <RealmSection title="✦ Magical Interests" icon={<Sparkles className="w-4 h-4" />} id="interests">
              <div className="flex flex-wrap gap-2">
                {(profile.interestTags ?? []).map(tag => findTopic(tag) ? (
                  <Link key={tag} to={topicPath(tag)} className="rounded-full border border-primary/30 px-3 py-1.5 text-xs text-primary">{findTopic(tag)}</Link>
                ) : (
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


</> },
{ id: 'gallery', title: 'Sacred Space', show: gallery.length > 0, body: <>
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
                      src={uploadedMediaUrl(item.imageUrl)}
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


</> },
{ id: 'featured', title: 'Featured Posts', show: featuredPosts.length > 0, body: <>
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


</> },
{ id: 'coven', title: 'My Coven', show: covenCount > 0, body: <>
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


</> },
{ id: 'favorites', title: 'Favorites', show: collections.length > 0, body: <>
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


</> },
{ id: 'soundscapes', title: 'Magical Soundscapes', show: soundscapes.length > 0, body: <>
            {/* Magical Soundscapes */}
            {soundscapes.length > 0 && (
              <RealmSection title="🎵 Magical Soundscapes" icon={<Music className="w-4 h-4" />} id="soundscapes">
                <div className="space-y-2">
                  {soundscapes.map(s => {
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


</> },
{ id: 'guestbook', title: 'Guestbook', show: !!guestbook?.enabled && (!!guestbook.entries.length || (canInteract && !isOwn && (guestbook.settings?.allowedSubmitters === "members" || (guestbook.settings?.allowedSubmitters === "coven" && isCovenMember)))), body: <>
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
                {canInteract && !isOwn && !guestbookSuccess && (() => {
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


</> },
{ id: 'milestones', title: 'Milestones', show: milestones.length > 0, body: <>
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

</> },
{ id: 'social', title: 'Social Links', show: links.length > 3, body: <>
<div className="profile-social flex-wrap">{renderSocial(links.slice(3))}</div>
</> },

          ].filter(section => section.show && profile.profileSections?.find(item => item.id === section.id)?.enabled !== false)
            .sort((a, b) => (profile.profileSections?.find(item => item.id === a.id)?.order ?? 99) - (profile.profileSections?.find(item => item.id === b.id)?.order ?? 99))
            .map(section => <section key={section.id} className="profile-about-section">
              <button type="button" aria-expanded={openSection === section.id} aria-controls={'profile-' + section.id}
                onClick={() => setOpenSection(current => current === section.id ? null : section.id)}>
                {section.title}<ChevronDown className="size-4" />
              </button>
              <div id={'profile-' + section.id} hidden={openSection !== section.id}>{section.body}</div>
            </section>)}
          {profile.createdAt && <p className="profile-empty">{pageContent.memberSincePrefix} {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>}
        </div>}
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
