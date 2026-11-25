/**
 * /admin/engagement — Community Engagement Analytics
 * Privacy-respecting aggregate metrics for admin/owner only.
 * No individual user data is exposed — all figures are counts and rates.
 */
import { useState, useEffect, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Navigate, Link } from 'react-router';
import { motion } from 'motion/react';
import {
  Users, MessageSquare, TrendingUp, RefreshCw,
  Activity, Bell, BarChart2, ArrowLeft, Flame,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/auth-client';

// ── Types ─────────────────────────────────────────────────────────────────────
interface TrendPoint { day: string; n: number; }

interface EngagementData {
  weeklyActiveMembers: number;
  firstWeekActivation: { total: number; activated: number; rate: number | null };
  postsWithReplies: number;
  newConversations: number;
  notificationDelivery: { sent: number; read: number; rate: number | null };
  day7ReturnRate: { cohort: number; returned: number; rate: number | null };
  day30ReturnRate: { cohort: number; returned: number; rate: number | null };
  dailyCheckinTrend: TrendPoint[];
  weeklyPostTrend: TrendPoint[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtPct(v: number | null): string {
  if (v === null) return 'n/a';
  return v.toFixed(1) + '%';
}

function fmtDay(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Sparkline({ data, color }: { data: TrendPoint[]; color: string }) {
  if (data.length < 2) {
    return (
      <div className="h-12 flex items-center justify-center text-xs"
        style={{ color: 'hsl(var(--muted-foreground))' }}>
        Not enough data
      </div>
    );
  }
  const max = Math.max(...data.map(d => d.n), 1);
  const W = 280;
  const H = 48;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - (d.n / max) * (H - 4) - 2;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-12" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon, label, value, sub, trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  trend?: TrendPoint[];
}) {
  return (
    <Card style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'hsl(var(--primary) / 0.15)' }}
          >
            <Icon size={14} style={{ color: 'hsl(var(--primary))' }} strokeWidth={2} />
          </div>
          <CardTitle
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
          >
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <p
          className="text-3xl font-bold leading-none"
          style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
        >
          {value}
        </p>
        {sub && (
          <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            {sub}
          </p>
        )}
        {trend && trend.length > 1 && (
          <div className="mt-3">
            <Sparkline data={trend} color="hsl(var(--primary))" />
            <div className="flex justify-between mt-1">
              <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{fmtDay(trend[0].day)}</span>
              <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>{fmtDay(trend[trend.length - 1].day)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Rate card ─────────────────────────────────────────────────────────────────
function RateCard({
  icon: Icon, label, rate, num, den, description,
}: {
  icon: React.ElementType;
  label: string;
  rate: number | null;
  num: number;
  den: number;
  description: string;
}) {
  const pct = rate ?? 0;
  const clampedPct = Math.min(pct, 100);
  return (
    <Card style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'hsl(var(--accent) / 0.15)' }}
          >
            <Icon size={14} style={{ color: 'hsl(var(--accent))' }} strokeWidth={2} />
          </div>
          <CardTitle
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
          >
            {label}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <p
          className="text-3xl font-bold leading-none"
          style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
        >
          {fmtPct(rate)}
        </p>
        <p className="text-xs mt-1" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          {num} of {den} {description}
        </p>
        {/* Progress bar */}
        <div
          className="mt-3 h-1.5 rounded-full overflow-hidden"
          style={{ background: 'hsl(var(--muted))' }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: clampedPct + '%', background: 'hsl(var(--accent))' }}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Skeleton grid ─────────────────────────────────────────────────────────────
function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 7 }).map((_, i) => (
        <Card key={i} style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
          <CardContent className="p-5">
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-8 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Admin nav links (shared pattern) ─────────────────────────────────────────
const ADMIN_NAV = [
  { href: '/admin/dashboard',    label: 'Inbox' },
  { href: '/admin/community',    label: 'Community' },
  { href: '/admin/roles',        label: 'Roles' },
  { href: '/admin/engagement',   label: 'Engagement' },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminEngagementPage() {
  const { session, isPending, isAuthenticated } = useSession();
  const [data, setData] = useState<EngagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/engagement', { credentials: 'include' });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json() as EngagementData);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!isPending && isAuthenticated) load();
  }, [isPending, isAuthenticated, load]);

  // Role check
  const u = session?.user as { platformRole?: string; isAdmin?: boolean } | undefined;
  const role = u?.platformRole ?? (u?.isAdmin ? 'admin' : 'member');
  const isAdmin = role === 'admin' || role === 'owner';

  if (!isPending && (!isAuthenticated || !isAdmin)) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <Helmet>
        <title>Engagement Analytics — Spellful Admin</title>
        <meta name="description" content="Admin-only aggregate engagement metrics: weekly active members, activation rates, return rates, and community trends." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen pb-20" style={{ background: 'hsl(var(--background))' }}>
        {/* Header */}
        <div
          className="sticky top-0 z-10 border-b px-4 sm:px-6 py-3 flex items-center gap-3"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
        >
          <Link
            to="/admin/dashboard"
            className="p-1.5 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: 'hsl(var(--muted-foreground))' }}
            aria-label="Back to admin dashboard"
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1
              className="text-base font-bold leading-tight"
              style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--foreground))' }}
            >
              Engagement Analytics
            </h1>
            <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
              Aggregate metrics — no individual data
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => load(true)}
            disabled={refreshing || loading}
            className="gap-1.5 text-xs"
            aria-label="Refresh metrics"
          >
            <RefreshCw size={13} strokeWidth={2} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </Button>
        </div>

        {/* Admin nav */}
        <div
          className="border-b px-4 sm:px-6 flex gap-1 overflow-x-auto"
          style={{ borderColor: 'hsl(var(--border))' }}
        >
          {ADMIN_NAV.map(n => (
            <Link
              key={n.href}
              to={n.href}
              className="shrink-0 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors"
              style={{
                fontFamily: 'var(--font-sans)',
                borderColor: n.href === '/admin/engagement' ? 'hsl(var(--primary))' : 'transparent',
                color: n.href === '/admin/engagement' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              }}
            >
              {n.label}
            </Link>
          ))}
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6">
          {error && (
            <div
              className="mb-6 rounded-xl px-4 py-3 text-sm"
              style={{ background: 'hsl(var(--destructive) / 0.12)', color: 'hsl(var(--destructive))', fontFamily: 'var(--font-sans)' }}
            >
              Failed to load metrics: {error}
            </div>
          )}

          {loading ? (
            <SkeletonGrid />
          ) : data ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' as const }}
            >
              {/* Section: Activity */}
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
              >
                Activity — last 7 days
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <StatCard
                  icon={Users}
                  label="Weekly active members"
                  value={data.weeklyActiveMembers.toLocaleString()}
                  sub="Posted, replied, checked in, or messaged"
                />
                <StatCard
                  icon={MessageSquare}
                  label="New conversations"
                  value={data.newConversations.toLocaleString()}
                  sub="DM threads started this week"
                />
                <StatCard
                  icon={BarChart2}
                  label="Posts with replies"
                  value={data.postsWithReplies.toLocaleString()}
                  sub="Community posts that sparked discussion (30 days)"
                />
              </div>

              {/* Section: Trends */}
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
              >
                Trends — last 14 days
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <StatCard
                  icon={Flame}
                  label="Daily check-ins"
                  value={data.dailyCheckinTrend.reduce((s, d) => s + d.n, 0).toLocaleString()}
                  sub="Total check-ins over 14 days"
                  trend={data.dailyCheckinTrend}
                />
                <StatCard
                  icon={Activity}
                  label="Community posts"
                  value={data.weeklyPostTrend.reduce((s, d) => s + d.n, 0).toLocaleString()}
                  sub="Total posts over 14 days"
                  trend={data.weeklyPostTrend}
                />
              </div>

              {/* Section: Rates */}
              <h2
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
              >
                Conversion &amp; retention rates
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                <RateCard
                  icon={TrendingUp}
                  label="First-week activation"
                  rate={data.firstWeekActivation.rate}
                  num={data.firstWeekActivation.activated}
                  den={data.firstWeekActivation.total}
                  description="new members completed onboarding"
                />
                <RateCard
                  icon={Bell}
                  label="Notification read rate"
                  rate={data.notificationDelivery.rate}
                  num={data.notificationDelivery.read}
                  den={data.notificationDelivery.sent}
                  description="notifications read (7 days)"
                />
                <RateCard
                  icon={Users}
                  label="Day-7 return rate"
                  rate={data.day7ReturnRate.rate}
                  num={data.day7ReturnRate.returned}
                  den={data.day7ReturnRate.cohort}
                  description="members from 7-14 days ago returned"
                />
                <RateCard
                  icon={Users}
                  label="Day-30 return rate"
                  rate={data.day30ReturnRate.rate}
                  num={data.day30ReturnRate.returned}
                  den={data.day30ReturnRate.cohort}
                  description="members from 30-60 days ago returned"
                />
              </div>

              {/* Privacy note */}
              <p
                className="text-[11px] text-center pb-4"
                style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
              >
                All figures are aggregates. No individual user data is stored or displayed here.
              </p>
            </motion.div>
          ) : null}
        </div>
      </main>
    </>
  );
}
