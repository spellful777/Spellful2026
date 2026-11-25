/**
 * CovenHearth
 *
 * The Coven Hearth hub tab inside /community. Shows:
 *   - Today's Question of the Day (QOTD)
 *   - Upcoming moon event countdown
 *   - Featured post (most-liked this week)
 *   - Recent discussions (4 newest)
 *   - Warm empty state when activity is low
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { MessageSquare, Heart, Flame, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

// -- Types --------------------------------------------------------------------
interface Qotd {
  question: string;
  prompt: string | null;
  emoji: string | null;
}

interface MoonEvent {
  phase: string;
  emoji: string;
  daysUntil: number;
}

interface Post {
  id: number;
  title: string;
  likeCount?: number;
  replyCount: number;
  username: string | null;
  createdAt: string | null;
  categoryName: string | null;
}

interface HearthData {
  qotd: Qotd | null;
  moonEvent: MoonEvent;
  featured: Post | null;
  recent: Post[];
}

// -- Helpers ------------------------------------------------------------------
function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return '';
  }
}

// -- Sub-components -----------------------------------------------------------
function QotdCard({ qotd }: { qotd: Qotd }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' as const }}
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, hsl(var(--primary) / 0.18) 0%, hsl(var(--accent) / 0.10) 100%)',
        border: '1px solid hsl(var(--primary) / 0.35)',
        boxShadow: '0 0 32px hsl(var(--primary) / 0.08)',
      }}
    >
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full pointer-events-none"
        aria-hidden="true"
        style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.25) 0%, transparent 70%)' }}
      />
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl" aria-hidden="true">{qotd.emoji ?? '🔮'}</span>
        <span
          className="text-[10px] font-semibold tracking-widest uppercase"
          style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
        >
          Question of the Day
        </span>
      </div>
      <p
        className="text-lg md:text-xl leading-snug mb-2"
        style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
      >
        {qotd.question}
      </p>
      {qotd.prompt && (
        <p
          className="text-sm leading-relaxed mb-4"
          style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
        >
          {qotd.prompt}
        </p>
      )}
      <Link
        to="/community/new"
        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
      >
        <Flame size={14} strokeWidth={2} />
        Share your answer
        <ChevronRight size={13} strokeWidth={2.5} />
      </Link>
    </motion.div>
  );
}

function MoonCard({ moonEvent }: { moonEvent: MoonEvent }) {
  const label = moonEvent.daysUntil === 0
    ? 'Tonight'
    : moonEvent.daysUntil === 1
    ? 'Tomorrow'
    : 'In ' + moonEvent.daysUntil + ' days';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06, ease: 'easeOut' as const }}
      className="rounded-2xl p-4 flex items-center gap-4"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
    >
      <span className="text-3xl shrink-0" aria-hidden="true">{moonEvent.emoji}</span>
      <div className="min-w-0">
        <p
          className="text-[10px] font-semibold tracking-widest uppercase mb-0.5"
          style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
        >
          Next moon event
        </p>
        <p
          className="text-base font-semibold leading-tight"
          style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
        >
          {moonEvent.phase}
        </p>
        <p
          className="text-xs mt-0.5"
          style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
        >
          {label}
        </p>
      </div>
    </motion.div>
  );
}

function FeaturedPostCard({ post }: { post: Post }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' as const }}
    >
      <p
        className="text-[10px] font-semibold tracking-widest uppercase mb-2"
        style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
      >
        Featured this week
      </p>
      <Link
        to={'/community/post/' + post.id}
        className="block rounded-2xl p-4 transition-colors hover:border-primary/50"
        style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
      >
        {post.categoryName && (
          <span
            className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mb-2"
            style={{ background: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
          >
            {post.categoryName}
          </span>
        )}
        <p
          className="text-sm font-semibold leading-snug mb-2 line-clamp-2"
          style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
        >
          {post.title}
        </p>
        <div
          className="flex items-center gap-3 text-xs"
          style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
        >
          {post.username && <span>@{post.username}</span>}
          <span className="flex items-center gap-1">
            <Heart size={11} strokeWidth={1.8} />
            {post.likeCount ?? 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare size={11} strokeWidth={1.8} />
            {post.replyCount}
          </span>
          {post.createdAt && <span className="ml-auto">{timeAgo(post.createdAt)}</span>}
        </div>
      </Link>
    </motion.div>
  );
}

function RecentPostRow({ post, delay }: { post: Post; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, delay, ease: 'easeOut' as const }}
    >
      <Link
        to={'/community/post/' + post.id}
        className="flex items-start gap-3 py-3 border-b last:border-b-0 transition-colors hover:opacity-80"
        style={{ borderColor: 'hsl(var(--border))' }}
      >
        <div className="flex-1 min-w-0">
          <p
            className="text-sm leading-snug line-clamp-2 mb-1"
            style={{ fontFamily: 'var(--font-sans)', color: 'hsl(var(--foreground))' }}
          >
            {post.title}
          </p>
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
          >
            {post.categoryName && <span>{post.categoryName}</span>}
            {post.username && <span>@{post.username}</span>}
            <span className="flex items-center gap-0.5">
              <MessageSquare size={10} strokeWidth={1.8} />
              {post.replyCount}
            </span>
          </div>
        </div>
        {post.createdAt && (
          <span
            className="shrink-0 text-[10px] mt-0.5"
            style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
          >
            {timeAgo(post.createdAt)}
          </span>
        )}
      </Link>
    </motion.div>
  );
}

function EmptyHearth() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl p-8 text-center"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
    >
      <span className="text-4xl block mb-3" aria-hidden="true">🔥</span>
      <p
        className="text-base mb-1"
        style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
      >
        The hearth is just warming up
      </p>
      <p
        className="text-sm mb-4"
        style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
      >
        Be the first to spark a conversation today.
      </p>
      <Link
        to="/community/new"
        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}
      >
        <Flame size={14} strokeWidth={2} />
        Start a discussion
      </Link>
    </motion.div>
  );
}

// -- Main component -----------------------------------------------------------
export default function CovenHearth() {
  const [data, setData] = useState<HearthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/community/hearth');
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as HearthData;
        if (!cancelled) setData(json);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 mt-2">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-20 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    );
  }

  const hasActivity = data && (data.featured || data.recent.length > 0);

  return (
    <section aria-label="Coven Hearth" className="space-y-4 mt-2">
      {data?.qotd && <QotdCard qotd={data.qotd} />}
      {data?.moonEvent && <MoonCard moonEvent={data.moonEvent} />}
      {hasActivity ? (
        <>
          {data.featured && <FeaturedPostCard post={data.featured} />}
          {data.recent.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.14, ease: 'easeOut' as const }}
              className="rounded-2xl px-4 pt-4 pb-1"
              style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            >
              <p
                className="text-[10px] font-semibold tracking-widest uppercase mb-1"
                style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
              >
                New discussions
              </p>
              {data.recent.map((post, i) => (
                <RecentPostRow key={post.id} post={post} delay={0.16 + i * 0.04} />
              ))}
            </motion.div>
          )}
        </>
      ) : (
        <EmptyHearth />
      )}
      <div className="text-center pb-2">
        <Link
          to="/community"
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
        >
          Browse all discussions
        </Link>
      </div>
    </section>
  );
}
