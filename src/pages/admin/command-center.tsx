/**
 * /admin/command-center — Owner Command Center
 * 9-tab unified control panel. Owner-only (platform_role = 'owner').
 *
 * Tabs: Dashboard · Members · Community · Messaging · Monetization ·
 *       Integrations · Logs · Settings · Help
 */
import { useState, useEffect, useCallback } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Navigate, Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, MessageSquare, Mail, CreditCard,
  Plug, ScrollText, Settings, HelpCircle,
  TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle,
  Shield, Crown, ChevronRight, ExternalLink, Activity,
  CheckCircle2, XCircle, Clock, Search, ChevronLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/lib/auth/auth-client';
import { command_center as cc } from 'virtual:content';

// ─── Types ────────────────────────────────────────────────────────────────────

interface KpiData {
  kpis: {
    totalMembers:    number;
    weeklyActive:    number;
    plusSubscribers: number;
    communityPosts:  number;
    modQueue:        number;
  };
  trends: {
    newMembersThisWeek: number;
    newMembersPrevWeek: number;
    memberDeltaPct:     number;
  };
  sparklines: {
    signups: number[];
    posts:   number[];
    days:    string[];
  };
  fetchedAt: string;
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard',     label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'members',       label: 'Members',          icon: Users },
  { id: 'community',     label: 'Community',        icon: MessageSquare },
  { id: 'messaging',     label: 'Messaging',        icon: Mail },
  { id: 'monetization',  label: 'Monetization',     icon: CreditCard },
  { id: 'email',         label: 'Email Marketing',  icon: TrendingUp },
  { id: 'integrations',  label: 'Integrations',     icon: Plug },
  { id: 'logs',          label: 'Logs',             icon: ScrollText },
  { id: 'settings',      label: 'Settings',         icon: Settings },
  { id: 'security',      label: 'Security & Trust', icon: Shield },
  { id: 'help',          label: 'Help',             icon: HelpCircle },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color = 'hsl(var(--primary))' }: { values: number[]; color?: string }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const w = 80;
  const h = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - (v / max) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label:    string;
  value:    number | string;
  sub?:     string;
  delta?:   number;
  spark?:   number[];
  sparkColor?: string;
  alert?:   boolean;
  loading?: boolean;
}

function KpiCard({ label, value, sub, delta, spark, sparkColor, alert, loading }: KpiCardProps) {
  const DeltaIcon = delta === undefined ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
  const deltaColor = delta === undefined ? 'hsl(var(--muted-foreground))' : delta > 0 ? 'hsl(var(--success))' : delta < 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))';

  return (
    <Card
      className="p-5 flex flex-col gap-3"
      style={{
        background: alert ? 'hsl(var(--destructive) / 0.08)' : 'hsl(var(--card))',
        border: `1px solid ${alert ? 'hsl(var(--destructive) / 0.4)' : 'hsl(var(--border))'}`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          {label}
        </p>
        {alert && <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--destructive))' }} />}
      </div>

      {loading ? (
        <Skeleton className="h-8 w-24" />
      ) : (
        <p className="text-3xl font-bold" style={{ color: alert ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {delta !== undefined && (
            <>
              <DeltaIcon className="w-3.5 h-3.5" style={{ color: deltaColor }} />
              <span className="text-xs font-medium" style={{ color: deltaColor, fontFamily: 'var(--font-sans)' }}>
                {delta > 0 ? '+' : ''}{delta}%
              </span>
            </>
          )}
          {sub && (
            <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
              {sub}
            </span>
          )}
        </div>
        {spark && <Sparkline values={spark} color={sparkColor ?? 'hsl(var(--primary))'} />}
      </div>
    </Card>
  );
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function DashboardTab() {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/command-center/dashboard')
      .then(r => r.json())
      .then((d: KpiData & { error?: string }) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load metrics'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis;
  const trends = data?.trends;
  const sparks = data?.sparklines;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
            {cc.platformOverview}
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            {data?.fetchedAt
              ? `Updated ${new Date(data.fetchedAt).toLocaleTimeString()}`
              : 'Loading metrics…'}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={load}
          disabled={loading}
          className="gap-2 text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-2" style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Total Members"
          value={kpis?.totalMembers ?? 0}
          sub={trends ? `+${trends.newMembersThisWeek} this week` : undefined}
          delta={trends?.memberDeltaPct}
          spark={sparks?.signups}
          sparkColor="hsl(var(--primary))"
          loading={loading}
        />
        <KpiCard
          label="Weekly Active"
          value={kpis?.weeklyActive ?? 0}
          sub="last 7 days"
          spark={sparks?.signups}
          sparkColor="hsl(var(--secondary))"
          loading={loading}
        />
        <KpiCard
          label="Plus Subscribers"
          value={kpis?.plusSubscribers ?? 0}
          sub="active subscriptions"
          sparkColor="hsl(var(--accent))"
          loading={loading}
        />
        <KpiCard
          label="Community Posts"
          value={kpis?.communityPosts ?? 0}
          sub="last 7 days"
          spark={sparks?.posts}
          sparkColor="hsl(var(--secondary))"
          loading={loading}
        />
        <KpiCard
          label="Moderation Queue"
          value={kpis?.modQueue ?? 0}
          sub="pending reports"
          alert={(kpis?.modQueue ?? 0) > 10}
          loading={loading}
        />
        <KpiCard
          label="New Members (7d)"
          value={trends?.newMembersThisWeek ?? 0}
          sub={`prev week: ${trends?.newMembersPrevWeek ?? 0}`}
          delta={trends?.memberDeltaPct}
          spark={sparks?.signups}
          loading={loading}
        />
      </div>

      {/* Quick links to existing admin tools */}
      <div>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          {cc.quickAccess}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { label: 'Admin Dashboard',    href: '/admin/dashboard',    desc: 'Applications & reports' },
            { label: 'Moderation Queue',   href: '/admin/moderator',    desc: 'Content moderation' },
            { label: 'Community Admin',    href: '/admin/community-admin', desc: 'Categories & announcements' },
            { label: 'Roles & Permissions', href: '/admin/roles',       desc: 'Manage platform roles' },
            { label: 'Engagement Analytics', href: '/admin/engagement', desc: 'Retention & activity metrics' },
            { label: 'Spells Library',     href: '/admin/spells',       desc: 'Manage spell content' },
          ].map(item => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center justify-between px-4 py-3 rounded-lg transition-colors hover:opacity-90"
              style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>{item.label}</p>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
            </Link>
          ))}
        </div>
      </div>

      {/* Email Marketing status card */}
      <EmailStatusMiniCard onNavigate={() => {
        // Dispatch a custom event the main page listens to for tab switching
        window.dispatchEvent(new CustomEvent('cc:navigate', { detail: 'email' }));
      }} />
    </div>
  );
}

// ─── Email status mini-card (shown on Dashboard tab) ─────────────────────────

interface EmailMiniData {
  kpis: { total: number; sent: number; failed: number };
  scheduler: { paused: boolean; lastRunDate: string | null; consecutiveFailDays: number } | null;
}

function EmailStatusMiniCard({ onNavigate }: { onNavigate: () => void }) {
  const [data, setData] = useState<EmailMiniData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/command-center/email-marketing?days=7')
      .then(r => r.ok ? r.json() as Promise<EmailMiniData> : Promise.reject())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const healthy = data?.scheduler && !data.scheduler.paused && data.scheduler.consecutiveFailDays === 0;
  const statusLabel = !data?.scheduler
    ? 'No data yet'
    : data.scheduler.paused
      ? 'Paused'
      : data.scheduler.consecutiveFailDays > 0
        ? `${data.scheduler.consecutiveFailDays} failure day(s)`
        : 'Running';
  const statusColor = !data?.scheduler
    ? 'hsl(var(--muted-foreground))'
    : data.scheduler.paused
      ? 'hsl(var(--warning))'
      : data.scheduler.consecutiveFailDays > 0
        ? 'hsl(var(--destructive))'
        : 'hsl(var(--success))';

  return (
    <div
      className="rounded-xl p-4 cursor-pointer transition-opacity hover:opacity-90"
      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
      onClick={onNavigate}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onNavigate(); }}
      aria-label="Open Email Marketing Analytics"
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          Email Marketing
        </p>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
          <span className="text-xs" style={{ color: statusColor, fontFamily: 'var(--font-sans)' }}>{statusLabel}</span>
        </div>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <div className="flex items-end gap-4">
          <div>
            <p className="text-2xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
              {data?.kpis.total.toLocaleString() ?? '—'}
            </p>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>sends last 7 days</p>
          </div>
          {(data?.kpis.failed ?? 0) > 0 && (
            <div>
              <p className="text-lg font-bold" style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-heading)' }}>
                {data!.kpis.failed.toLocaleString()}
              </p>
              <p className="text-xs" style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-sans)' }}>failed</p>
            </div>
          )}
          <div className="ml-auto">
            <p className="text-xs" style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}>
              {healthy ? 'View analytics →' : 'View details →'}
            </p>
          </div>
        </div>
      )}
      {data?.scheduler?.lastRunDate && (
        <p className="text-xs mt-2" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          Last run: {data.scheduler.lastRunDate}
        </p>
      )}
    </div>
  );
}

// ─── Members tab ─────────────────────────────────────────────────────────────

interface MemberRow {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  image: string | null;
  platformRole: string | null;
  accountType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface MembersResponse {
  members: MemberRow[];
  hasMore: boolean;
  total: number;
  offset: number;
  limit: number;
}

const ROLE_COLORS: Record<string, string> = {
  owner:     'hsl(var(--primary))',
  admin:     'hsl(var(--accent))',
  moderator: 'hsl(var(--secondary))',
  support:   'hsl(var(--info))',
  member:    'hsl(var(--muted-foreground))',
};

const ROLE_OPTIONS = ['', 'owner', 'admin', 'moderator', 'support', 'member'];
const TYPE_OPTIONS = ['', 'community_member', 'creator', 'organization', 'official'];
const PAGE_SIZE = 25;

function MembersTab() {
  const { data: memberTabSession } = useSession();
  const memberTabRole = (memberTabSession?.user as { platformRole?: string } | undefined)?.platformRole;
  const isOwnerActor = memberTabRole === 'owner';
  // Admins may only assign roles below admin; owner can assign any role
  const assignableRoles = isOwnerActor
    ? ROLE_OPTIONS.filter(Boolean)
    : ROLE_OPTIONS.filter(r => r !== '' && r !== 'owner' && r !== 'admin');
  const [query, setQuery]         = useState('');
  const [role, setRole]           = useState('');
  const [accountType, setAccType] = useState('');
  const [offset, setOffset]       = useState(0);
  const [data, setData]           = useState<MembersResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback((q: string, r: string, t: string, off: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (r) params.set('role', r);
    if (t) params.set('accountType', t);
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(off));
    fetch(`/api/admin/command-center/members?${params}`)
      .then(res => res.json())
      .then((d: MembersResponse & { error?: string }) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load members'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(query, role, accountType, offset); }, [load, query, role, accountType, offset]);

  // Debounced search
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => { setQuery(debouncedQ); setOffset(0); }, 350);
    return () => clearTimeout(t);
  }, [debouncedQ]);

  function handleRoleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setRole(e.target.value); setOffset(0);
  }
  function handleTypeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setAccType(e.target.value); setOffset(0);
  }

  async function changeRole(memberId: string, memberName: string | null, newRole: string) {
    setActionMsg(null);
    const res = await fetch('/api/admin/roles', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: memberId, field: 'platformRole', value: newRole, reason: 'Owner action via Command Center' }),
    });
    const json = await res.json() as { error?: string };
    if (json.error) {
      setActionMsg(`Error: ${json.error}`);
    } else {
      setActionMsg(`Role updated for ${memberName ?? memberId}`);
      load(query, role, accountType, offset);
    }
  }

  const members = data?.members ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          Members
        </h2>
        <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          {data ? `${data.total.toLocaleString()} total` : '—'}
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <input
            type="text"
            placeholder="Search name, username, email…"
            value={debouncedQ}
            onChange={e => setDebouncedQ(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={{
              background: 'hsl(var(--muted))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              fontFamily: 'var(--font-sans)',
              '--tw-ring-color': 'hsl(var(--ring))',
            } as React.CSSProperties}
          />
        </div>
        {/* Role filter */}
        <select
          value={role}
          onChange={handleRoleChange}
          className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
          style={{
            background: 'hsl(var(--muted))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {ROLE_OPTIONS.map(r => (
            <option key={r} value={r}>{r ? r.charAt(0).toUpperCase() + r.slice(1) : 'All roles'}</option>
          ))}
        </select>
        {/* Account type filter */}
        <select
          value={accountType}
          onChange={handleTypeChange}
          className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
          style={{
            background: 'hsl(var(--muted))',
            border: '1px solid hsl(var(--border))',
            color: 'hsl(var(--foreground))',
            fontFamily: 'var(--font-sans)',
          }}
        >
          {TYPE_OPTIONS.map(t => (
            <option key={t} value={t}>{t ? t.replace(/_/g, ' ') : 'All types'}</option>
          ))}
        </select>
        <Button size="sm" variant="outline" onClick={() => load(query, role, accountType, offset)} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Action feedback */}
      {actionMsg && (
        <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)', border: '1px solid hsl(var(--border))' }}>
          {actionMsg}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* Member list */}
      <div className="space-y-1.5">
        {loading && !members.length && Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-2.5 w-48" />
            </div>
          </div>
        ))}

        {!loading && !members.length && (
          <div className="text-center py-10 text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            No members found
          </div>
        )}

        {members.map(m => (
          <div
            key={m.id}
            className="flex items-center gap-3 px-4 py-3 rounded-lg"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
          >
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
              {m.image
                ? <img src={m.image} alt="" className="w-full h-full object-cover" />
                : <span className="text-xs font-bold" style={{ color: 'hsl(var(--muted-foreground))' }}>{(m.name ?? m.username ?? '?')[0]?.toUpperCase()}</span>
              }
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>
                  {m.name ?? m.username ?? 'Unknown'}
                </span>
                {m.username && (
                  <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>@{m.username}</span>
                )}
                <Badge
                  variant="outline"
                  className="text-xs px-1.5 py-0"
                  style={{
                    color: ROLE_COLORS[m.platformRole ?? 'member'] ?? 'hsl(var(--muted-foreground))',
                    borderColor: (ROLE_COLORS[m.platformRole ?? 'member'] ?? 'hsl(var(--muted-foreground))') + '66',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  {m.platformRole ?? 'member'}
                </Badge>
                {m.accountType && m.accountType !== 'community_member' && (
                  <Badge variant="outline" className="text-xs px-1.5 py-0" style={{ color: 'hsl(var(--accent))', borderColor: 'hsl(var(--accent) / 0.4)', fontFamily: 'var(--font-sans)' }}>
                    {m.accountType.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              <p className="text-xs truncate mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                {m.email ?? '—'}
                {m.createdAt && <span className="ml-2">Joined {new Date(m.createdAt).toLocaleDateString()}</span>}
              </p>
            </div>

            {/* Quick actions */}
            <div className="flex items-center gap-1 shrink-0">
              <Link
                to={`/u/${m.username ?? m.id}`}
                className="p-1.5 rounded-md transition-colors hover:opacity-80"
                style={{ background: 'hsl(var(--muted))' }}
                title="View profile"
              >
                <ExternalLink className="w-3.5 h-3.5" style={{ color: 'hsl(var(--muted-foreground))' }} />
              </Link>

              {/* Role quick-change */}
              <select
                value={m.platformRole ?? 'member'}
                onChange={e => changeRole(m.id, m.name, e.target.value)}
                className="px-2 py-1 rounded-md text-xs focus:outline-none"
                style={{
                  background: 'hsl(var(--muted))',
                  border: '1px solid hsl(var(--border))',
                  color: 'hsl(var(--foreground))',
                  fontFamily: 'var(--font-sans)',
                }}
                title="Change role"
              >
                {assignableRoles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data && (data.hasMore || offset > 0) && (
        <div className="flex items-center justify-between pt-2">
          <Button
            size="sm" variant="outline"
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0 || loading}
            className="gap-1.5 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </Button>
          <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            {offset + 1}–{Math.min(offset + PAGE_SIZE, data.total)} of {data.total.toLocaleString()}
          </span>
          <Button
            size="sm" variant="outline"
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={!data.hasMore || loading}
            className="gap-1.5 text-xs"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Community tab ───────────────────────────────────────────────────────────

interface PostRow {
  id: number;
  title: string | null;
  type: string | null;
  isHidden: boolean | null;
  isPinned: boolean | null;
  isLocked: boolean | null;
  likeCount: number | null;
  replyCount: number | null;
  createdAt: string | null;
  authorName: string | null;
  authorUsername: string | null;
}

interface ReportRow {
  id: number;
  targetType: string | null;
  targetId: number | null;
  targetStringId: string | null;
  reason: string | null;
  details: string | null;
  status: string | null;
  createdAt: string | null;
  reporterName: string | null;
  reporterUsername: string | null;
}

interface PostsResponse  { posts:   PostRow[];   hasMore: boolean; total: number; }
interface QueueResponse  { reports: ReportRow[]; hasMore: boolean; total: number; }

type CommunityView = 'posts' | 'queue';

const COMMUNITY_PAGE = 25;

function CommunityTab() {
  const [view, setView]           = useState<CommunityView>('posts');
  const [offset, setOffset]       = useState(0);
  const [postsData, setPostsData] = useState<PostsResponse | null>(null);
  const [queueData, setQueueData] = useState<QueueResponse | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback((v: CommunityView, off: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/command-center/community?view=${v}&limit=${COMMUNITY_PAGE}&offset=${off}`)
      .then(r => r.json())
      .then((d: (PostsResponse | QueueResponse) & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        if (v === 'posts') setPostsData(d as PostsResponse);
        else setQueueData(d as QueueResponse);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(view, offset); }, [load, view, offset]);

  function switchView(v: CommunityView) { setView(v); setOffset(0); }

  async function modAction(body: Record<string, unknown>, successMsg: string) {
    setActionMsg(null);
    const res = await fetch('/api/admin/command-center/community', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json() as { ok?: boolean; error?: string };
    if (json.error) { setActionMsg(`Error: ${json.error}`); return; }
    setActionMsg(successMsg);
    load(view, offset);
  }

  const reports = queueData?.reports ?? [];
  const currentData = view === 'posts' ? postsData : queueData;

  return (
    <div className="space-y-4">
      {/* Header + view toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          Community
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'hsl(var(--muted))' }}>
          {(['posts', 'queue'] as CommunityView[]).map(v => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: view === v ? 'hsl(var(--card))' : 'transparent',
                color: view === v ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--font-sans)',
                boxShadow: view === v ? '0 1px 3px hsl(var(--background) / 0.5)' : 'none',
              }}
            >
              {v === 'posts' ? 'Recent Posts' : `Queue${queueData ? ` (${queueData.total})` : ''}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            {currentData ? `${currentData.total.toLocaleString()} total` : '—'}
          </span>
          <Button size="sm" variant="outline" onClick={() => load(view, offset)} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Feedback */}
      {actionMsg && (
        <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', border: '1px solid hsl(var(--border))', fontFamily: 'var(--font-sans)' }}>
          {actionMsg}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* ── Posts view ── */}
      {view === 'posts' && (
        <div className="space-y-1.5">
          {loading && !postsData && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <Skeleton className="h-3 w-3/4 mb-2" /><Skeleton className="h-2.5 w-1/2" />
            </div>
          ))}
          {!loading && postsData?.posts.length === 0 && (
            <p className="text-center py-10 text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>No posts yet</p>
          )}
          {(postsData?.posts ?? []).map(post => (
            <div key={post.id} className="flex items-start gap-3 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className="text-sm font-medium truncate" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>{post.title}</span>
                  {post.isPinned  && <Badge variant="outline" className="text-xs px-1.5 py-0" style={{ color: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary) / 0.4)', fontFamily: 'var(--font-sans)' }}>pinned</Badge>}
                  {post.isLocked  && <Badge variant="outline" className="text-xs px-1.5 py-0" style={{ color: 'hsl(var(--warning))', borderColor: 'hsl(var(--warning) / 0.4)', fontFamily: 'var(--font-sans)' }}>locked</Badge>}
                  {post.isHidden  && <Badge variant="outline" className="text-xs px-1.5 py-0" style={{ color: 'hsl(var(--destructive))', borderColor: 'hsl(var(--destructive) / 0.4)', fontFamily: 'var(--font-sans)' }}>hidden</Badge>}
                </div>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                  by @{post.authorUsername ?? '?'} · {post.replyCount ?? 0} replies · {post.likeCount ?? 0} likes
                  {post.createdAt && <span className="ml-2">{new Date(post.createdAt).toLocaleDateString()}</span>}
                </p>
              </div>
              {/* Post actions */}
              <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                <button
                  onClick={() => modAction({ action: post.isHidden ? 'unhide-post' : 'hide-post', postId: post.id }, post.isHidden ? 'Post unhidden' : 'Post hidden')}
                  className="px-2 py-1 rounded text-xs transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}
                >
                  {post.isHidden ? 'Unhide' : 'Hide'}
                </button>
                <button
                  onClick={() => modAction({ action: post.isPinned ? 'unpin-post' : 'pin-post', postId: post.id }, post.isPinned ? 'Post unpinned' : 'Post pinned')}
                  className="px-2 py-1 rounded text-xs transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}
                >
                  {post.isPinned ? 'Unpin' : 'Pin'}
                </button>
                <button
                  onClick={() => modAction({ action: post.isLocked ? 'unlock-post' : 'lock-post', postId: post.id }, post.isLocked ? 'Post unlocked' : 'Post locked')}
                  className="px-2 py-1 rounded text-xs transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}
                >
                  {post.isLocked ? 'Unlock' : 'Lock'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Queue view ── */}
      {view === 'queue' && (
        <div className="space-y-1.5">
          {loading && !queueData && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <Skeleton className="h-3 w-2/3 mb-2" /><Skeleton className="h-2.5 w-1/2" />
            </div>
          ))}
          {!loading && queueData?.reports.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10">
              <CheckCircle2 className="w-8 h-8" style={{ color: 'hsl(var(--success))' }} />
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>Queue is clear</p>
            </div>
          )}
          {reports.map(report => (
            <div key={report.id} className="flex items-start gap-3 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <Badge variant="outline" className="text-xs px-1.5 py-0" style={{ color: 'hsl(var(--accent))', borderColor: 'hsl(var(--accent) / 0.4)', fontFamily: 'var(--font-sans)' }}>
                    {report.targetType}
                  </Badge>
                  <span className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>
                    {report.reason}
                  </span>
                </div>
                {report.details && (
                  <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{report.details}</p>
                )}
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                  Reported by @{report.reporterUsername ?? '?'}
                  {report.createdAt && <span className="ml-2">{new Date(report.createdAt).toLocaleDateString()}</span>}
                  {report.targetType !== 'profile' && <span className="ml-2">Target #{report.targetId}</span>}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => modAction({ action: 'resolve-report', reportId: report.id }, 'Report resolved')}
                  className="px-2 py-1 rounded text-xs transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--success) / 0.15)', color: 'hsl(var(--success))', fontFamily: 'var(--font-sans)' }}
                >
                  Resolve
                </button>
                <button
                  onClick={() => modAction({ action: 'dismiss-report', reportId: report.id }, 'Report dismissed')}
                  className="px-2 py-1 rounded text-xs transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {currentData && (currentData.hasMore || offset > 0) && (
        <div className="flex items-center justify-between pt-2">
          <Button size="sm" variant="outline" onClick={() => setOffset(Math.max(0, offset - COMMUNITY_PAGE))} disabled={offset === 0 || loading} className="gap-1.5 text-xs">
            <ChevronLeft className="w-3.5 h-3.5" />Previous
          </Button>
          <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            {offset + 1}–{Math.min(offset + COMMUNITY_PAGE, currentData.total)} of {currentData.total.toLocaleString()}
          </span>
          <Button size="sm" variant="outline" onClick={() => setOffset(offset + COMMUNITY_PAGE)} disabled={!currentData.hasMore || loading} className="gap-1.5 text-xs">
            Next<ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Messaging tab ───────────────────────────────────────────────────────────

interface ThreadRow {
  id: number;
  createdAt: string | null;
  updatedAt: string | null;
  participant1Name: string | null;
  participant1Username: string | null;
  participant2Name: string | null;
  participant2Username: string | null;
  messageCount: number | null;
}

interface RequestRow {
  id: number;
  status: string | null;
  createdAt: string | null;
  requesterName: string | null;
  requesterUsername: string | null;
  recipientName: string | null;
  recipientUsername: string | null;
}

interface ThreadsResponse  { threads:  ThreadRow[];  hasMore: boolean; total: number; }
interface RequestsResponse { requests: RequestRow[]; hasMore: boolean; total: number; }

type MessagingView = 'threads' | 'requests';

const MESSAGING_PAGE = 25;

function MessagingTab() {
  const [view, setView]               = useState<MessagingView>('threads');
  const [offset, setOffset]           = useState(0);
  const [threadsData, setThreadsData] = useState<ThreadsResponse | null>(null);
  const [reqData, setReqData]         = useState<RequestsResponse | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const load = useCallback((v: MessagingView, off: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/command-center/messaging?view=${v}&limit=${MESSAGING_PAGE}&offset=${off}`)
      .then(r => r.json())
      .then((d: (ThreadsResponse | RequestsResponse) & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        if (v === 'threads') setThreadsData(d as ThreadsResponse);
        else setReqData(d as RequestsResponse);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(view, offset); }, [load, view, offset]);

  function switchView(v: MessagingView) { setView(v); setOffset(0); }

  const currentData = view === 'threads' ? threadsData : reqData;

  return (
    <div className="space-y-4">
      {/* Header + view toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          Messaging
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'hsl(var(--muted))' }}>
          {(['threads', 'requests'] as MessagingView[]).map(v => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: view === v ? 'hsl(var(--card))' : 'transparent',
                color: view === v ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--font-sans)',
                boxShadow: view === v ? '0 1px 3px hsl(var(--background) / 0.5)' : 'none',
              }}
            >
              {v === 'threads'
                ? `Threads${threadsData ? ` (${threadsData.total.toLocaleString()})` : ''}`
                : `Requests${reqData ? ` (${reqData.total})` : ''}`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            {currentData ? `${currentData.total.toLocaleString()} total` : '—'}
          </span>
          <Button size="sm" variant="outline" onClick={() => load(view, offset)} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* E2E notice */}
      <div className="flex items-start gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', fontFamily: 'var(--font-sans)' }}>
        <Shield className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'hsl(var(--accent))' }} />
        <span>Messages are end-to-end encrypted. Only metadata (participants, count, timestamps) is visible here — message content is never accessible to admins.</span>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* ── Threads view ── */}
      {view === 'threads' && (
        <div className="space-y-1.5">
          {loading && !threadsData && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <Skeleton className="h-3 w-3/4 mb-2" /><Skeleton className="h-2.5 w-1/2" />
            </div>
          ))}
          {!loading && threadsData?.threads.length === 0 && (
            <p className="text-center py-10 text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>No conversations yet</p>
          )}
          {(threadsData?.threads ?? []).map(thread => (
            <div key={thread.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>
                  @{thread.participant1Username ?? '?'}
                  <span className="mx-1.5" style={{ color: 'hsl(var(--muted-foreground))' }}>↔</span>
                  @{thread.participant2Username ?? '?'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                  {Number(thread.messageCount ?? 0).toLocaleString()} messages
                  {thread.updatedAt && (
                    <span className="ml-2">· last {new Date(thread.updatedAt).toLocaleDateString()}</span>
                  )}
                </p>
              </div>
              <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0" style={{ color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))', fontFamily: 'var(--font-sans)' }}>
                #{thread.id}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* ── Requests view ── */}
      {view === 'requests' && (
        <div className="space-y-1.5">
          {loading && !reqData && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <Skeleton className="h-3 w-2/3 mb-2" /><Skeleton className="h-2.5 w-1/2" />
            </div>
          ))}
          {!loading && reqData?.requests.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10">
              <CheckCircle2 className="w-8 h-8" style={{ color: 'hsl(var(--success))' }} />
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>No pending requests</p>
            </div>
          )}
          {(reqData?.requests ?? []).map(req => (
            <div key={req.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>
                  @{req.requesterUsername ?? '?'}
                  <span className="mx-1.5 text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>→</span>
                  @{req.recipientUsername ?? '?'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                  {req.createdAt && new Date(req.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Badge variant="outline" className="text-xs px-1.5 py-0 shrink-0" style={{ color: 'hsl(var(--warning))', borderColor: 'hsl(var(--warning) / 0.4)', fontFamily: 'var(--font-sans)' }}>
                pending
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {currentData && (currentData.hasMore || offset > 0) && (
        <div className="flex items-center justify-between pt-2">
          <Button size="sm" variant="outline" onClick={() => setOffset(Math.max(0, offset - MESSAGING_PAGE))} disabled={offset === 0 || loading} className="gap-1.5 text-xs">
            <ChevronLeft className="w-3.5 h-3.5" />Previous
          </Button>
          <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            {offset + 1}–{Math.min(offset + MESSAGING_PAGE, currentData.total)} of {currentData.total.toLocaleString()}
          </span>
          <Button size="sm" variant="outline" onClick={() => setOffset(offset + MESSAGING_PAGE)} disabled={!currentData.hasMore || loading} className="gap-1.5 text-xs">
            Next<ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Monetization tab ────────────────────────────────────────────────────────

interface MonetizationKpis {
  active: number;
  gracePeriod: number;
  production: number;
  sandbox: number;
  mrrEstimate: number;
  newLast30: number;
  newLast7: number;
  churnLast30: number;
  churnRate: number;
}

interface StatusBreakdownItem {
  status: string;
  count: number;
  color: 'success' | 'warning' | 'muted' | 'destructive';
}

interface RecentActivityRow {
  id: number;
  status: string;
  environment: string;
  appleProductId: string;
  createdAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
}

interface MonetizationData {
  kpis: MonetizationKpis;
  statusBreakdown: StatusBreakdownItem[];
  total: number;
  recentActivity: RecentActivityRow[];
  priceUsd: number;
}

const STATUS_COLOR_MAP: Record<string, string> = {
  success:     'hsl(var(--success))',
  warning:     'hsl(var(--warning))',
  muted:       'hsl(var(--muted-foreground))',
  destructive: 'hsl(var(--destructive))',
};

const STATUS_BG_MAP: Record<string, string> = {
  success:     'hsl(var(--success) / 0.15)',
  warning:     'hsl(var(--warning) / 0.15)',
  muted:       'hsl(var(--muted))',
  destructive: 'hsl(var(--destructive) / 0.15)',
};

function fmtDate(val: string | null): string {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function MonetizationTab() {
  const [data, setData]       = useState<MonetizationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/command-center/monetization')
      .then(r => r.json())
      .then((d: MonetizationData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          Monetization
        </h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* IAP notice */}
      <div className="px-3 py-2 rounded-lg text-xs flex items-start gap-2" style={{ background: 'hsl(var(--info) / 0.1)', color: 'hsl(var(--info))', border: '1px solid hsl(var(--info) / 0.25)', fontFamily: 'var(--font-sans)' }}>
        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span>Revenue figures are estimates based on subscription count &times; list price. Actual payouts are in App Store Connect after Apple&apos;s 30% commission and tax withholding.</span>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Active subscribers',  value: kpis?.active,      sub: 'all environments',          color: 'success' },
          { label: 'Production active',   value: kpis?.production,  sub: 'live App Store subs',       color: 'success' },
          { label: 'MRR estimate',        value: kpis ? `$${kpis.mrrEstimate.toFixed(2)}` : null, sub: 'production only, pre-commission', color: 'primary' },
          { label: 'New last 30 days',    value: kpis?.newLast30,   sub: 'active subs created',       color: 'info' },
          { label: 'New last 7 days',     value: kpis?.newLast7,    sub: 'active subs created',       color: 'info' },
          { label: 'Churn rate (30d)',    value: kpis ? `${kpis.churnRate}%` : null, sub: `${kpis?.churnLast30 ?? 0} cancellations`, color: kpis && kpis.churnRate > 5 ? 'destructive' : 'muted' },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            {loading && value === undefined ? (
              <>
                <Skeleton className="h-6 w-16 mb-1" />
                <Skeleton className="h-2.5 w-24" />
              </>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums" style={{ color: `hsl(var(--${color}))`, fontFamily: 'var(--font-heading)' }}>
                  {value ?? '—'}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{label}</p>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground) / 0.7)', fontFamily: 'var(--font-sans)' }}>{sub}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Status breakdown */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
        <div className="px-4 py-2.5" style={{ background: 'hsl(var(--muted))', borderBottom: '1px solid hsl(var(--border))' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            Subscription status breakdown
          </p>
        </div>
        <div style={{ background: 'hsl(var(--card))' }}>
          {loading && !data && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i < 4 ? '1px solid hsl(var(--border))' : 'none' }}>
              <Skeleton className="h-2.5 w-20" /><Skeleton className="h-2.5 w-8 ml-auto" />
            </div>
          ))}
          {(data?.statusBreakdown ?? []).map((item, i, arr) => {
            const pct = data && data.total > 0 ? Math.round((item.count / data.total) * 100) : 0;
            return (
              <div key={item.status} className="px-4 py-2.5" style={{ borderBottom: i < arr.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-xs font-medium capitalize" style={{ background: STATUS_BG_MAP[item.color], color: STATUS_COLOR_MAP[item.color], fontFamily: 'var(--font-sans)' }}>
                    {item.status.replace('_', ' ')}
                  </span>
                  <span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>
                    {item.count.toLocaleString()}
                  </span>
                  <span className="text-xs w-8 text-right" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                    {pct}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: STATUS_COLOR_MAP[item.color] }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Environment split */}
      {data && (
        <div className="flex gap-3">
          <div className="flex-1 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(var(--success))', fontFamily: 'var(--font-heading)' }}>{data.kpis.production}</p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>Production</p>
          </div>
          <div className="flex-1 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(var(--warning))', fontFamily: 'var(--font-heading)' }}>{data.kpis.sandbox}</p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>Sandbox / TestFlight</p>
          </div>
          <div className="flex-1 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
            <p className="text-lg font-bold tabular-nums" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-heading)' }}>{data.kpis.gracePeriod}</p>
            <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>Grace period</p>
          </div>
        </div>
      )}

      {/* IAP product placeholder */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
        <div className="px-4 py-2.5" style={{ background: 'hsl(var(--muted))', borderBottom: '1px solid hsl(var(--border))' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            IAP products
          </p>
        </div>
        <div className="px-4 py-3 flex items-center gap-3" style={{ background: 'hsl(var(--card))' }}>
          <CreditCard className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>com.spellful.plus.monthly</p>
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>$4.99 / month &mdash; Auto-renewable subscription</p>
          </div>
          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: 'hsl(var(--warning) / 0.15)', color: 'hsl(var(--warning))', fontFamily: 'var(--font-sans)' }}>
            Pending App Store
          </span>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
        <div className="px-4 py-2.5" style={{ background: 'hsl(var(--muted))', borderBottom: '1px solid hsl(var(--border))' }}>
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            Recent subscription activity
          </p>
        </div>
        {loading && !data && (
          <div style={{ background: 'hsl(var(--card))' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: i < 3 ? '1px solid hsl(var(--border))' : 'none' }}>
                <Skeleton className="h-2.5 w-16" /><Skeleton className="h-2.5 w-20 ml-auto" />
              </div>
            ))}
          </div>
        )}
        {data && data.recentActivity.length === 0 && (
          <div className="px-4 py-6 text-center" style={{ background: 'hsl(var(--card))' }}>
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>No subscription records yet</p>
          </div>
        )}
        {data && data.recentActivity.length > 0 && (
          <div style={{ background: 'hsl(var(--card))' }}>
            {data.recentActivity.map((row, i, arr) => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap" style={{ borderBottom: i < arr.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
                <span className="px-1.5 py-0.5 rounded text-xs font-medium capitalize" style={{ background: STATUS_BG_MAP[row.status === 'active' ? 'success' : row.status === 'grace_period' ? 'warning' : row.status === 'cancelled' || row.status === 'refunded' ? 'destructive' : 'muted'], color: STATUS_COLOR_MAP[row.status === 'active' ? 'success' : row.status === 'grace_period' ? 'warning' : row.status === 'cancelled' || row.status === 'refunded' ? 'destructive' : 'muted'], fontFamily: 'var(--font-sans)' }}>
                  {row.status.replace('_', ' ')}
                </span>
                <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                  {row.environment === 'sandbox' ? 'Sandbox' : 'Production'}
                </span>
                <span className="ml-auto text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                  Created {fmtDate(row.createdAt)}
                </span>
                {row.expiresAt && (
                  <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                    Expires {fmtDate(row.expiresAt)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Settings tab ────────────────────────────────────────────────────────────

interface PlatformConfig {
  registrationOpen: boolean;
  requireEmailVerification: boolean;
  plusEnabled: boolean;
  communityEnabled: boolean;
  messagingEnabled: boolean;
  maintenanceMode: boolean;
}

interface RoleInfo {
  role: string;
  count: number;
  description: string;
  permissions: string[];
}

type SettingsView = 'config' | 'roles' | 'email-preview';

const CONFIG_LABELS: Record<keyof PlatformConfig, { label: string; description: string; danger?: boolean }> = {
  registrationOpen:         { label: 'Open registration',          description: 'Allow new members to create accounts.' },
  requireEmailVerification: { label: 'Require email verification', description: 'New accounts must verify their email before accessing the platform.' },
  plusEnabled:              { label: 'Spellful Plus',              description: 'Enable Plus subscriptions and premium features.' },
  communityEnabled:         { label: 'Community',                  description: 'Enable the Coven community, posts, and discussions.' },
  messagingEnabled:         { label: 'Direct messaging',           description: 'Enable end-to-end encrypted DMs between members.' },
  maintenanceMode:          { label: 'Maintenance mode',           description: 'Show a maintenance page to all non-owner visitors.', danger: true },
};

const EMAIL_TEMPLATE_OPTIONS = [
  { value: 'welcome',        label: 'Welcome email' },
  { value: 'verification',   label: 'Email verification' },
  { value: 'password-reset', label: 'Password reset' },
];

const ROLE_BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  owner:     { bg: 'hsl(var(--primary) / 0.15)',     text: 'hsl(var(--primary))' },
  admin:     { bg: 'hsl(var(--destructive) / 0.15)', text: 'hsl(var(--destructive))' },
  moderator: { bg: 'hsl(var(--accent) / 0.15)',      text: 'hsl(var(--accent))' },
  support:   { bg: 'hsl(var(--info) / 0.15)',        text: 'hsl(var(--info))' },
  member:    { bg: 'hsl(var(--muted))',              text: 'hsl(var(--muted-foreground))' },
};

function SettingsTab() {
  const [view, setView]           = useState<SettingsView>('config');
  const [config, setConfig]       = useState<PlatformConfig | null>(null);
  const [roles, setRoles]         = useState<RoleInfo[] | null>(null);
  const [emailHtml, setEmailHtml] = useState<string | null>(null);
  const [emailTemplate, setEmailTemplate] = useState('welcome');
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadView = useCallback((v: SettingsView, tmpl?: string) => {
    setLoading(true);
    setError(null);
    const t = tmpl ?? emailTemplate;
    const url = v === 'email-preview'
      ? `/api/admin/command-center/settings?view=${v}&template=${t}`
      : `/api/admin/command-center/settings?view=${v}`;
    fetch(url)
      .then(r => r.json())
      .then((d: { config?: PlatformConfig; roles?: RoleInfo[]; html?: string; error?: string }) => {
        if (d.error) { setError(d.error); return; }
        if (v === 'config' && d.config)      setConfig(d.config);
        if (v === 'roles' && d.roles)        setRoles(d.roles);
        if (v === 'email-preview' && d.html) setEmailHtml(d.html);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [emailTemplate]);

  useEffect(() => { loadView(view); }, [loadView, view]);

  function switchView(v: SettingsView) { setView(v); }

  async function toggleConfig(key: keyof PlatformConfig, value: boolean) {
    if (!config) return;
    setSaving(key);
    setSuccessMsg(null);
    setError(null);
    const res = await fetch('/api/admin/command-center/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    const json = await res.json() as { ok?: boolean; config?: PlatformConfig; error?: string };
    if (json.error) { setError(json.error); }
    else if (json.config) { setConfig(json.config); setSuccessMsg('Saved'); }
    setSaving(null);
  }

  function changeEmailTemplate(tmpl: string) {
    setEmailTemplate(tmpl);
    setEmailHtml(null);
    loadView('email-preview', tmpl);
  }

  return (
    <div className="space-y-4">
      {/* Header + view toggle */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          Settings
        </h2>
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'hsl(var(--muted))' }}>
          {(['config', 'roles', 'email-preview'] as SettingsView[]).map(v => (
            <button
              key={v}
              onClick={() => switchView(v)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
              style={{
                background: view === v ? 'hsl(var(--card))' : 'transparent',
                color: view === v ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
                fontFamily: 'var(--font-sans)',
                boxShadow: view === v ? '0 1px 3px hsl(var(--background) / 0.5)' : 'none',
              }}
            >
              {v === 'config' ? 'Platform' : v === 'roles' ? 'Roles' : 'Email Preview'}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={() => loadView(view)} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Feedback */}
      {successMsg && (
        <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'hsl(var(--success) / 0.1)', color: 'hsl(var(--success))', border: '1px solid hsl(var(--success) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{successMsg}
        </div>
      )}
      {error && (
        <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* ── Platform config view ── */}
      {view === 'config' && (
        <div className="space-y-2">
          {loading && !config && Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <Skeleton className="h-3 w-1/3 mb-2" /><Skeleton className="h-2.5 w-2/3" />
            </div>
          ))}
          {config && (Object.keys(CONFIG_LABELS) as (keyof PlatformConfig)[]).map(key => {
            const meta = CONFIG_LABELS[key];
            const val  = config[key];
            const isSaving = saving === key;
            return (
              <div key={key} className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: `1px solid ${meta.danger && val ? 'hsl(var(--destructive) / 0.4)' : 'hsl(var(--border))'}` }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: meta.danger && val ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>
                    {meta.label}
                    {meta.danger && val && (
                      <span className="ml-2 text-xs font-normal" style={{ color: 'hsl(var(--destructive))' }}>ACTIVE</span>
                    )}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{meta.description}</p>
                </div>
                <button
                  onClick={() => toggleConfig(key, !val)}
                  disabled={isSaving}
                  className="relative shrink-0 w-10 h-5 rounded-full transition-colors focus:outline-none"
                  style={{ background: val ? (meta.danger ? 'hsl(var(--destructive))' : 'hsl(var(--primary))') : 'hsl(var(--muted-foreground) / 0.4)' }}
                  aria-label={`${val ? 'Disable' : 'Enable'} ${meta.label}`}
                >
                  <span
                    className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform"
                    style={{ background: 'hsl(var(--foreground))', transform: val ? 'translateX(20px)' : 'translateX(0)' }}
                  />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Roles view ── */}
      {view === 'roles' && (
        <div className="space-y-2">
          {loading && !roles && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
              <Skeleton className="h-3 w-1/4 mb-2" /><Skeleton className="h-2.5 w-3/4" />
            </div>
          ))}
          {(roles ?? []).map(r => {
            const colors = ROLE_BADGE_COLORS[r.role] ?? ROLE_BADGE_COLORS.member;
            return (
              <div key={r.role} className="px-4 py-3 rounded-lg" style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}>
                <div className="flex items-center gap-3 mb-1.5">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold capitalize" style={{ background: colors.bg, color: colors.text, fontFamily: 'var(--font-sans)' }}>
                    {r.role}
                  </span>
                  <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                    {r.count.toLocaleString()} {r.count === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <p className="text-xs mb-1.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{r.description}</p>
                <div className="flex flex-wrap gap-1">
                  {r.permissions.map(p => (
                    <span key={p} className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{p}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Email preview view ── */}
      {view === 'email-preview' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            {EMAIL_TEMPLATE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => changeEmailTemplate(opt.value)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                style={{
                  background: emailTemplate === opt.value ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                  color: emailTemplate === opt.value ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  fontFamily: 'var(--font-sans)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {loading && !emailHtml && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
              <Skeleton className="h-96 w-full" />
            </div>
          )}
          {emailHtml && (
            <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
              <iframe
                srcDoc={emailHtml}
                title="Email preview"
                className="w-full bg-[hsl(var(--email-preview-bg))]"
                style={{ height: '520px' }}
                sandbox="allow-same-origin"
              />
            </div>
          )}
          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            Preview only — edit templates in <code style={{ fontFamily: 'monospace' }}>src/server/lib/email-template.ts</code>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Placeholder tab ──────────────────────────────────────────────────────────

function PlaceholderTab({ id, label, icon: Icon, description, links }: {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  links?: { label: string; href: string }[];
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'hsl(var(--muted))' }}>
        <Icon className="w-7 h-7" style={{ color: 'hsl(var(--primary))' }} />
      </div>
      <div>
        <h2 className="text-xl font-bold mb-1" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          {label}
        </h2>
        <p className="text-sm max-w-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          {description}
        </p>
      </div>
      {links && links.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center mt-2">
          {links.map(l => (
            <Link
              key={l.href}
              to={l.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity hover:opacity-80"
              style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', fontFamily: 'var(--font-sans)' }}
            >
              {l.label}
              <ExternalLink className="w-3 h-3" />
            </Link>
          ))}
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: 'hsl(var(--muted-foreground) / 0.6)', fontFamily: 'var(--font-sans)' }}>
        Tab ID: {id} — full build coming next
      </p>
    </div>
  );
}

// ─── Integrations status tab ──────────────────────────────────────────────────


// ─── Integrations tab ─────────────────────────────────────────────────────────

type IntegrationStatus = 'ok' | 'warning' | 'error' | 'pending';

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: IntegrationStatus;
  note: string;
  detail?: string;
  docUrl?: string;
}

interface IntegrationGroup {
  category: string;
  items: IntegrationItem[];
}

interface IntegrationSummary {
  total: number;
  ok: number;
  warning: number;
  error: number;
  pending: number;
}

interface IntegrationsData {
  grouped: IntegrationGroup[];
  summary: IntegrationSummary;
}

const INTEGRATION_STATUS_ICON: Record<IntegrationStatus, React.ReactNode> = {
  ok:      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--success))' }} />,
  warning: <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--warning))' }} />,
  error:   <XCircle className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--destructive))' }} />,
  pending: <Clock className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />,
};

function integrationStatusCss(status: IntegrationStatus): React.CSSProperties {
  if (status === 'ok')      return { color: 'hsl(var(--success))',          background: 'hsl(var(--success) / 0.12)',     border: '1px solid hsl(var(--success) / 0.3)' };
  if (status === 'warning') return { color: 'hsl(var(--warning))',          background: 'hsl(var(--warning) / 0.12)',     border: '1px solid hsl(var(--warning) / 0.3)' };
  if (status === 'error')   return { color: 'hsl(var(--destructive))',      background: 'hsl(var(--destructive) / 0.12)', border: '1px solid hsl(var(--destructive) / 0.3)' };
  return                           { color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))',              border: '1px solid hsl(var(--border))' };
}

const CATEGORY_ORDER = ['Auth', 'Business', 'Notifications', 'Payments', 'CI/CD'];

function IntegrationsTab() {
  const [data, setData]       = useState<IntegrationsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/command-center/integrations')
      .then(r => r.json())
      .then((d: IntegrationsData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Sort groups by canonical order
  const groups = data
    ? [...data.grouped].sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
    : [];

  const s = data?.summary;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          Integrations &amp; API Status
        </h2>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* Summary pills */}
      {(loading || s) && (
        <div className="flex flex-wrap gap-2">
          {(['ok', 'warning', 'error', 'pending'] as IntegrationStatus[]).map(st => (
            <div key={st} className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium" style={integrationStatusCss(st)}>
              {loading && !s ? <Skeleton className="h-3 w-8" /> : (
                <>{INTEGRATION_STATUS_ICON[st]}<span className="capitalize">{st}</span><span className="tabular-nums">{s?.[st] ?? 0}</span></>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Groups */}
      {loading && !data && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, gi) => (
            <div key={gi} className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
              <div className="px-4 py-2.5" style={{ background: 'hsl(var(--muted))' }}>
                <Skeleton className="h-3 w-20" />
              </div>
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3" style={{ background: 'hsl(var(--card))', borderTop: '1px solid hsl(var(--border))' }}>
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <div className="flex-1"><Skeleton className="h-3 w-32 mb-1" /><Skeleton className="h-2.5 w-48" /></div>
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {groups.map(group => (
        <div key={group.category} className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
          {/* Category header */}
          <div className="px-4 py-2.5 flex items-center gap-2" style={{ background: 'hsl(var(--muted))', borderBottom: '1px solid hsl(var(--border))' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
              {group.category}
            </p>
            {/* Category health dot */}
            {(() => {
              const hasError   = group.items.some(i => i.status === 'error');
              const hasWarning = group.items.some(i => i.status === 'warning');
              const allOk      = group.items.every(i => i.status === 'ok');
              const dotColor   = hasError ? 'hsl(var(--destructive))' : hasWarning ? 'hsl(var(--warning))' : allOk ? 'hsl(var(--success))' : 'hsl(var(--muted-foreground))';
              return <span className="ml-auto w-2 h-2 rounded-full" style={{ background: dotColor }} />;
            })()}
          </div>

          {/* Items */}
          {group.items.map((item, i) => (
            <div
              key={item.id}
              className="flex items-start gap-3 px-4 py-3"
              style={{ background: 'hsl(var(--card))', borderTop: i > 0 ? '1px solid hsl(var(--border))' : 'none' }}
            >
              <div className="mt-0.5">{INTEGRATION_STATUS_ICON[item.status]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>{item.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{item.note}</p>
                {item.detail && (
                  <p className="text-xs mt-0.5 italic" style={{ color: 'hsl(var(--muted-foreground) / 0.7)', fontFamily: 'var(--font-sans)' }}>{item.detail}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2 py-0.5 rounded text-xs font-medium capitalize" style={integrationStatusCss(item.status)}>
                  {item.status}
                </span>
                {item.docUrl && (
                  <a href={item.docUrl} target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-100 transition-opacity">
                    <ExternalLink className="w-3.5 h-3.5" style={{ color: 'hsl(var(--muted-foreground))' }} />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── Logs tab ─────────────────────────────────────────────────────────────────

interface AuditRow {
  id: number;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  ipAddress: string | null;
  createdAt: string;
  actorId: string;
  actorName: string | null;
  actorEmail: string | null;
  targetId: string | null;
  targetName: string | null;
  targetEmail: string | null;
}

interface AuditLogData {
  rows: AuditRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  actionTypes: string[];
}

// Colour-code action categories
function actionColor(action: string): React.CSSProperties {
  if (action.startsWith('role.'))         return { color: 'hsl(var(--accent))',      background: 'hsl(var(--accent) / 0.12)',      border: '1px solid hsl(var(--accent) / 0.3)' };
  if (action.startsWith('account_type.')) return { color: 'hsl(var(--info))',        background: 'hsl(var(--info) / 0.12)',        border: '1px solid hsl(var(--info) / 0.3)' };
  if (action.startsWith('badge.'))        return { color: 'hsl(var(--warning))',     background: 'hsl(var(--warning) / 0.12)',     border: '1px solid hsl(var(--warning) / 0.3)' };
  if (action.startsWith('config.'))       return { color: 'hsl(var(--success))',     background: 'hsl(var(--success) / 0.12)',     border: '1px solid hsl(var(--success) / 0.3)' };
  if (action.startsWith('post.') || action.startsWith('report.'))
                                          return { color: 'hsl(var(--destructive))', background: 'hsl(var(--destructive) / 0.12)', border: '1px solid hsl(var(--destructive) / 0.3)' };
  return { color: 'hsl(var(--muted-foreground))', background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' };
}

function fmtTs(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
}

function LogsTab() {
  const [data, setData]           = useState<AuditLogData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [page, setPage]           = useState(1);
  const [filterAction, setFilterAction] = useState('');
  const [filterQ, setFilterQ]     = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');

  // Debounce free-text search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filterQ), 350);
    return () => clearTimeout(t);
  }, [filterQ]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: '25' });
    if (filterAction) params.set('action', filterAction);
    if (debouncedQ)   params.set('q', debouncedQ);
    fetch(`/api/admin/command-center/audit-log?${params}`)
      .then(r => r.json())
      .then((d: AuditLogData & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setData(d);
      })
      .catch(() => setError('Failed to load'))
      .finally(() => setLoading(false));
  }, [page, filterAction, debouncedQ]);

  useEffect(() => { load(); }, [load]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [filterAction, debouncedQ]);

  const actionTypes = data?.actionTypes ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
          Audit Log
        </h2>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-xs tabular-nums" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
              {data.total.toLocaleString()} event{data.total !== 1 ? 's' : ''} (30 days)
            </span>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5 text-xs">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-lg text-xs flex items-center gap-2" style={{ background: 'hsl(var(--destructive) / 0.1)', color: 'hsl(var(--destructive))', border: '1px solid hsl(var(--destructive) / 0.3)', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {/* Free-text search */}
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <input
            type="text"
            placeholder="Search action, value, reason…"
            value={filterQ}
            onChange={e => setFilterQ(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-md text-xs outline-none focus:ring-1 focus:ring-primary"
            style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}
          />
        </div>
        {/* Action type filter */}
        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="px-2 py-1.5 rounded-md text-xs outline-none focus:ring-1 focus:ring-primary"
          style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}
        >
          <option value="">All action types</option>
          {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        {(filterAction || filterQ) && (
          <Button size="sm" variant="ghost" className="text-xs h-7 px-2" onClick={() => { setFilterAction(''); setFilterQ(''); }}>
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
        {/* Column headers */}
        <div
          className="grid text-xs font-semibold px-3 py-2 gap-2"
          style={{ gridTemplateColumns: '1fr 1.4fr 1fr 1fr 80px', background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)', borderBottom: '1px solid hsl(var(--border))' }}
        >
          <span>Action</span>
          <span>Actor</span>
          <span>Target</span>
          <span>Change</span>
          <span>When</span>
        </div>

        {/* Skeleton rows */}
        {loading && !data && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="grid px-3 py-2.5 gap-2 items-center" style={{ gridTemplateColumns: '1fr 1.4fr 1fr 1fr 80px', borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}>
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </div>
        ))}

        {/* Empty state */}
        {!loading && data && data.rows.length === 0 && (
          <div className="px-4 py-10 text-center" style={{ background: 'hsl(var(--card))' }}>
            <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'hsl(var(--muted-foreground))' }} />
            <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
              {filterAction || filterQ ? 'No events match your filters.' : 'No audit events in the last 30 days.'}
            </p>
          </div>
        )}

        {/* Data rows */}
        {data?.rows.map((row, i) => (
          <div
            key={row.id}
            className="grid px-3 py-2.5 gap-2 items-start text-xs"
            style={{ gridTemplateColumns: '1fr 1.4fr 1fr 1fr 80px', borderTop: i > 0 ? '1px solid hsl(var(--border))' : 'none', background: 'hsl(var(--card))', fontFamily: 'var(--font-sans)' }}
          >
            {/* Action badge */}
            <div>
              <span className="inline-block px-1.5 py-0.5 rounded text-xs font-medium" style={actionColor(row.action)}>
                {row.action}
              </span>
              {row.reason && (
                <p className="mt-0.5 text-xs italic truncate max-w-[140px]" style={{ color: 'hsl(var(--muted-foreground))' }} title={row.reason}>
                  {row.reason}
                </p>
              )}
            </div>
            {/* Actor */}
            <div className="min-w-0">
              <p className="font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>{row.actorName ?? '—'}</p>
              <p className="truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{row.actorEmail ?? row.actorId}</p>
            </div>
            {/* Target */}
            <div className="min-w-0">
              {row.targetId ? (
                <>
                  <p className="font-medium truncate" style={{ color: 'hsl(var(--foreground))' }}>{row.targetName ?? '—'}</p>
                  <p className="truncate" style={{ color: 'hsl(var(--muted-foreground))' }}>{row.targetEmail ?? row.targetId}</p>
                </>
              ) : (
                <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>
              )}
            </div>
            {/* Change */}
            <div className="min-w-0 space-y-0.5">
              {row.oldValue && (
                <p className="truncate line-through" style={{ color: 'hsl(var(--muted-foreground))' }} title={row.oldValue}>{row.oldValue}</p>
              )}
              {row.newValue && (
                <p className="truncate font-medium" style={{ color: 'hsl(var(--foreground))' }} title={row.newValue}>{row.newValue}</p>
              )}
              {!row.oldValue && !row.newValue && <span style={{ color: 'hsl(var(--muted-foreground))' }}>—</span>}
            </div>
            {/* Timestamp */}
            <p className="tabular-nums" style={{ color: 'hsl(var(--muted-foreground))' }}>{fmtTs(row.createdAt)}</p>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Help tab ─────────────────────────────────────────────────────────────────

function HelpTab() {
  const [changelogOpen, setChangelogOpen] = useState<string | null>(null);

  const docs: { category: string; items: { title: string; href: string; desc: string }[] }[] = [
    {
      category: 'Platform',
      items: [
        { title: 'BetterAuth Docs',        href: 'https://www.better-auth.com/docs',          desc: 'Auth configuration, sessions, OAuth providers' },
        { title: 'Drizzle ORM Docs',       href: 'https://orm.drizzle.team/docs',             desc: 'Database schema, queries, migrations' },
        { title: 'React Router v8',        href: 'https://reactrouter.com/en/main',           desc: 'Routing, loaders, SSR patterns' },
      ],
    },
    {
      category: 'Mobile & CI/CD',
      items: [
        { title: 'Capacitor iOS Docs',     href: 'https://capacitorjs.com/docs/ios',          desc: 'iOS build, signing, deployment' },
        { title: 'Capacitor Android Docs', href: 'https://capacitorjs.com/docs/android',      desc: 'Android build, signing, deployment' },
        { title: 'Codemagic Docs',         href: 'https://docs.codemagic.io',                 desc: 'CI/CD pipeline, env groups, triggers' },
        { title: 'Apple Developer Portal', href: 'https://developer.apple.com',               desc: 'App Store Connect, certs, provisioning' },
        { title: 'App Store Connect',      href: 'https://appstoreconnect.apple.com',         desc: 'App submission, IAP products, TestFlight' },
      ],
    },
    {
      category: 'Integrations',
      items: [
        { title: 'Google Cloud Console',   href: 'https://console.cloud.google.com',          desc: 'OAuth credentials, APIs & Services' },
        { title: 'Facebook for Developers',href: 'https://developers.facebook.com',           desc: 'Business page OAuth, Graph API' },
        { title: 'Web Push (VAPID)',        href: 'https://web.dev/articles/push-notifications-overview', desc: 'Push notification architecture' },
      ],
    },
  ];

  const support = [
    { label: 'General support',   value: 'support@spellful.com',   href: 'mailto:support@spellful.com' },
    { label: 'Legal & privacy',   value: 'legal@spellful.com',     href: 'mailto:legal@spellful.com' },
    { label: 'GitHub repository', value: 'github.com/spellful',    href: 'https://github.com/spellful' },
  ];

  const blockers = [
    'Populate app-store-connect env group in Codemagic',
    'Add APPLE_CLIENT_ID + APPLE_CLIENT_SECRET to Secrets',
    'Add APPLE_ROOT_CA_G3_FINGERPRINT to Secrets',
    'Complete Apple portal tasks A–E (certs, provisioning, IAP)',
    'Create com.spellful.plus.monthly IAP product in App Store Connect',
    'Retry Facebook Business Page OAuth',
    'Fix Airo → GitHub sync (iPhone Safari → revoke & reconnect)',
  ];

  const changelog: { version: string; date: string; tag: string; tagColor: string; notes: string[] }[] = [
    {
      version: 'v1.10',
      date: 'Nov 23, 2026',
      tag: 'Latest',
      tagColor: 'hsl(var(--success))',
      notes: [
        'Owner Command Center: Logs tab with 30-day audit event history, free-text search, action-type filter, pagination',
        'Owner Command Center: Integrations tab with live secret checks, DB-backed OAuth counts, refresh button',
        'Integrations: color-coded status badges (ok / warning / error / pending), grouped by category',
        'Audit log API: raw SQL join for actor + target user names/emails',
      ],
    },
    {
      version: 'v1.9',
      date: 'Nov 22, 2026',
      tag: 'Stable',
      tagColor: 'hsl(var(--info))',
      notes: [
        'Owner Command Center: Monetization tab with KPI grid, status breakdown, environment split, IAP product card',
        'Monetization API: active subs, MRR estimate, churn rate, recent 10 subscription rows',
        'Settings tab: platform config toggles, roles hierarchy with live counts, email preview iframe',
        'Facebook Business Page sync integration added',
        'Google review responses integration added',
      ],
    },
    {
      version: 'v1.8',
      date: 'Nov 21, 2026',
      tag: 'Stable',
      tagColor: 'hsl(var(--info))',
      notes: [
        'Owner Command Center: Community tab with recent posts and moderation queue',
        'Community admin APIs: paginated posts/queue, 6 post actions + 2 report actions',
        'Google Search Console integration wired',
        'Google Reviews widget added',
        'Google Analytics GA4 integration added',
      ],
    },
    {
      version: 'v1.7',
      date: 'Nov 20, 2026',
      tag: 'Stable',
      tagColor: 'hsl(var(--info))',
      notes: [
        'Direct Messaging: ECDH end-to-end encrypted DMs, first-message rule, message requests inbox',
        'Chat wallpapers (Spellful Plus feature)',
        'Owner Command Center: Messaging tab with threads + requests, E2E notice banner',
        'Profile Studio: Look, About, Magic, More tabs with live preview card',
      ],
    },
    {
      version: 'v1.6',
      date: 'Nov 19, 2026',
      tag: 'Stable',
      tagColor: 'hsl(var(--info))',
      notes: [
        'Spellful Plus Phase 1: subscription infrastructure, Apple IAP webhook, entitlement checks',
        'Welcome email system with idempotency lock on email_events table',
        'First-week onboarding journey: 7 progressive tasks, auto-dismisses after 14 days',
        'Coven Hearth: QOTD, moon event countdown, featured post, recent discussions',
        'Daily Check-In: mood/intention chips, streak counter, grimoire save',
      ],
    },
    {
      version: 'v1.5',
      date: 'Nov 18, 2026',
      tag: 'Stable',
      tagColor: 'hsl(var(--info))',
      notes: [
        'Community Engagement Phase 1–5: notification badges, CovenAlertToast, SinceYouWereAwayBanner',
        'Profile Link Sharing 2.0: native share, copy link, copy invite text, share on X',
        'SSR OG meta on /u/[username] via route loader',
        'Grimoire: full CRUD, 8 entry types (spell, tarot, journal, herb, crystal, ritual, dream, moon)',
        'Privacy policy and Terms of Use pages generated',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
        Help & Documentation
      </h2>

      {/* Blockers */}
      <div className="rounded-lg px-4 py-4 space-y-2" style={{ background: 'hsl(var(--destructive) / 0.07)', border: '1px solid hsl(var(--destructive) / 0.3)' }}>
        <p className="text-sm font-semibold flex items-center gap-2" style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-sans)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Open blockers
        </p>
        {blockers.map(item => (
          <div key={item} className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: 'hsl(var(--warning))' }} />
            <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{item}</p>
          </div>
        ))}
      </div>

      {/* Docs */}
      <div className="space-y-4">
        {docs.map(group => (
          <div key={group.category}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
              {group.category}
            </p>
            <div className="space-y-1.5">
              {group.items.map(d => (
                <a
                  key={d.href}
                  href={d.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 rounded-lg transition-opacity hover:opacity-80"
                  style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>{d.title}</p>
                    <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{d.desc}</p>
                  </div>
                  <ExternalLink className="w-4 h-4 shrink-0 ml-3" style={{ color: 'hsl(var(--muted-foreground))' }} />
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Support contacts */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          Support
        </p>
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
          {support.map((s, i) => (
            <a
              key={s.href}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-4 py-3 transition-opacity hover:opacity-80"
              style={{ background: 'hsl(var(--card))', borderTop: i > 0 ? '1px solid hsl(var(--border))' : 'none' }}
            >
              <div>
                <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{s.label}</p>
                <p className="text-sm font-medium" style={{ color: 'hsl(var(--primary))', fontFamily: 'var(--font-sans)' }}>{s.value}</p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
            </a>
          ))}
        </div>
      </div>

      {/* Changelog */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
          Release notes
        </p>
        <div className="space-y-1.5">
          {changelog.map(entry => (
            <div key={entry.version} className="rounded-lg overflow-hidden" style={{ border: '1px solid hsl(var(--border))' }}>
              {/* Header row — click to expand */}
              <button
                type="button"
                onClick={() => setChangelogOpen(changelogOpen === entry.version ? null : entry.version)}
                className="w-full flex items-center justify-between px-4 py-3 text-left transition-opacity hover:opacity-80"
                style={{ background: 'hsl(var(--card))' }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>{entry.version}</span>
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium" style={{ color: entry.tagColor, background: `${entry.tagColor}1a`, border: `1px solid ${entry.tagColor}4d` }}>
                    {entry.tag}
                  </span>
                  <span className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{entry.date}</span>
                </div>
                <ChevronRight
                  className="w-4 h-4 shrink-0 transition-transform"
                  style={{ color: 'hsl(var(--muted-foreground))', transform: changelogOpen === entry.version ? 'rotate(90deg)' : 'none' }}
                />
              </button>
              {/* Expanded notes */}
              {changelogOpen === entry.version && (
                <div className="px-4 pb-3 space-y-1.5" style={{ borderTop: '1px solid hsl(var(--border))', background: 'hsl(var(--muted))' }}>
                  {entry.notes.map((note, ni) => (
                    <div key={ni} className="flex items-start gap-2 pt-1.5">
                      <div className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: 'hsl(var(--primary))' }} />
                      <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>{note}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Email Marketing Tab ──────────────────────────────────────────────────────

type EmailDays = 7 | 30 | 90;

interface EmailKpis {
  total: number; sent: number; failed: number; skipped: number;
  uniqueRecipients: number; deliveryRate: number | null;
}
interface EmailOccasion {
  occasion: string; total: number; sent: number; failed: number;
  skipped: number; uniqueRecipients: number; plusCtaCount: number;
  deliveryRate: number | null;
}
interface EmailTrendDay { day: string; total: number; sent: number; failed: number; }
interface EmailConsentCat { category: string; optedIn: number; optedOut: number; }
interface EmailScheduler {
  paused: boolean; lastRunAt: string | null; lastRunDate: string | null;
  lastRunSentCount: number; lastRunSkipCount: number; lastRunErrorCount: number;
  lastRunErrorDetail: string | null; consecutiveFailDays: number;
}
interface EmailMarketingData {
  days: number; since: string;
  scheduler: EmailScheduler | null;
  kpis: EmailKpis;
  occasions: EmailOccasion[];
  trend: EmailTrendDay[];
  consent: { categories: EmailConsentCat[]; totalWithAnyConsent: number; totalAllOptedIn: number; };
}

const OCCASION_LABELS: Record<string, string> = {
  birthday: 'Birthday',
  new_moon: 'New Moon',
  full_moon: 'Full Moon',
  sabbat: 'Sabbat / Seasonal',
  re_engagement: 'Re-engagement',
  discovery: 'Feature Discovery',
};

const CONSENT_LABELS: Record<string, string> = {
  birthday: 'Birthday Wishes',
  moon_seasonal: 'Moon & Seasonal',
  community: 'Community & Events',
  discovery: 'Feature Tips',
  plus_offers: 'Spellful Plus Offers',
};

function EmailMarketingTab() {
  const [days, setDays] = useState<EmailDays>(30);
  const [data, setData] = useState<EmailMarketingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pauseLoading, setPauseLoading] = useState(false);
  const [sortCol, setSortCol] = useState<'total' | 'sent' | 'deliveryRate'>('total');

  const load = useCallback(async (d: EmailDays) => {
    setLoading(true); setError('');
    try {
      const r = await fetch(`/api/admin/command-center/email-marketing?days=${d}`);
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json() as EmailMarketingData);
    } catch {
      setError('Failed to load email marketing analytics.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(days); }, [days, load]);

  async function togglePause() {
    if (!data?.scheduler) return;
    setPauseLoading(true);
    try {
      await fetch('/api/moments/status', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paused: !data.scheduler.paused }),
      });
      await load(days);
    } catch { /* non-fatal */ }
    setPauseLoading(false);
  }

  const cardStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '0.75rem', padding: '1.25rem' } as const;
  const labelStyle = { color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)', fontSize: '0.75rem', textTransform: 'uppercase' as const, letterSpacing: '0.05em' } as const;
  const valueStyle = { color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 700, lineHeight: 1.1 } as const;
  const subStyle = { color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)', fontSize: '0.75rem' } as const;

  const sortedOccasions = data ? [...data.occasions].sort((a, b) => {
    if (sortCol === 'deliveryRate') return (b.deliveryRate ?? -1) - (a.deliveryRate ?? -1);
    const col = sortCol as 'total' | 'sent';
    return b[col] - a[col];
  }) : [];

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
            Email Marketing Analytics
          </h2>
          <p style={subStyle}>Spellful Moments lifecycle emails — real data only</p>
        </div>
        <div className="flex items-center gap-2">
          {([7, 30, 90] as EmailDays[]).map(d => (
            <button key={d}
              onClick={() => setDays(d)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: days === d ? 'hsl(var(--primary))' : 'hsl(var(--muted))',
                color: days === d ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                border: '1px solid hsl(var(--border))',
                fontFamily: 'var(--font-sans)',
              }}>
              {d}d
            </button>
          ))}
          <button onClick={() => load(days)} title="Refresh"
            className="p-1.5 rounded-lg transition-colors"
            style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
            <RefreshCw className="w-4 h-4" style={{ color: 'hsl(var(--muted-foreground))' }} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl" style={{ background: 'hsl(var(--destructive)/0.1)', border: '1px solid hsl(var(--destructive)/0.3)' }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: 'hsl(var(--destructive))' }} />
          <p style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-sans)', fontSize: '0.875rem' }}>{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Scheduler status card */}
          <div style={cardStyle}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p style={labelStyle}>Scheduler Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: data.scheduler?.paused ? 'hsl(var(--warning))' : 'hsl(var(--success))' }} />
                  <span className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>
                    {data.scheduler ? (data.scheduler.paused ? 'Paused' : 'Running') : 'No state yet'}
                  </span>
                </div>
                {data.scheduler && (
                  <div className="mt-2 space-y-0.5">
                    <p style={subStyle}>Last run: {data.scheduler.lastRunDate ?? 'Never'}</p>
                    <p style={subStyle}>
                      Sent {data.scheduler.lastRunSentCount} · Skipped {data.scheduler.lastRunSkipCount} · Errors {data.scheduler.lastRunErrorCount}
                    </p>
                    {data.scheduler.consecutiveFailDays > 0 && (
                      <p style={{ ...subStyle, color: 'hsl(var(--destructive))' }}>
                        ⚠ {data.scheduler.consecutiveFailDays} consecutive failure day(s)
                      </p>
                    )}
                    {data.scheduler.lastRunErrorDetail && (
                      <p style={{ ...subStyle, color: 'hsl(var(--destructive))' }} className="truncate max-w-xs">
                        {data.scheduler.lastRunErrorDetail}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {data.scheduler && (
                <Button size="sm" variant="outline" onClick={togglePause} disabled={pauseLoading}
                  className="text-xs shrink-0">
                  {pauseLoading ? 'Updating…' : data.scheduler.paused ? '▶ Resume' : '⏸ Pause'}
                </Button>
              )}
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total Sends', value: data.kpis.total.toLocaleString(), sub: `last ${days} days` },
              { label: 'Delivered', value: data.kpis.sent.toLocaleString(), sub: 'status = sent' },
              { label: 'Failed', value: data.kpis.failed.toLocaleString(), sub: 'status = failed', warn: data.kpis.failed > 0 },
              { label: 'Skipped', value: data.kpis.skipped.toLocaleString(), sub: 'dedup / no consent' },
              { label: 'Unique Recipients', value: data.kpis.uniqueRecipients.toLocaleString(), sub: 'deduplicated' },
              { label: 'Delivery Rate', value: data.kpis.deliveryRate !== null ? `${data.kpis.deliveryRate}%` : '—', sub: 'sent ÷ total', note: 'Provider-accepted; not confirmed inbox delivery' },
            ].map(k => (
              <div key={k.label} style={cardStyle}>
                <p style={labelStyle}>{k.label}</p>
                <p style={{ ...valueStyle, color: k.warn ? 'hsl(var(--destructive))' : 'hsl(var(--foreground))' }}>{k.value}</p>
                <p style={subStyle}>{k.sub}</p>
                {k.note && <p style={{ ...subStyle, marginTop: '0.25rem', fontStyle: 'italic' }}>{k.note}</p>}
              </div>
            ))}
          </div>

          {/* No data yet notice */}
          {data.kpis.total === 0 && (
            <div className="p-4 rounded-xl text-center" style={{ background: 'hsl(var(--muted))', border: '1px solid hsl(var(--border))' }}>
              <p className="text-sm" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                No Moments emails have been sent in the last {days} days. The scheduler runs daily — check back after the first run.
              </p>
            </div>
          )}

          {/* Campaign breakdown table */}
          {data.occasions.length > 0 && (
            <div style={cardStyle}>
              <div className="flex items-center justify-between mb-3">
                <p style={{ ...labelStyle, fontSize: '0.8rem' }}>Campaign Breakdown</p>
                <div className="flex items-center gap-1">
                  <span style={subStyle}>Sort:</span>
                  {(['total', 'sent', 'deliveryRate'] as const).map(col => (
                    <button key={col} onClick={() => setSortCol(col)}
                      className="px-2 py-0.5 rounded text-xs"
                      style={{
                        background: sortCol === col ? 'hsl(var(--primary) / 0.15)' : 'transparent',
                        color: sortCol === col ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                        fontFamily: 'var(--font-sans)',
                      }}>
                      {col === 'deliveryRate' ? 'Rate' : col.charAt(0).toUpperCase() + col.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ fontFamily: 'var(--font-sans)', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                      {['Campaign', 'Total', 'Sent', 'Failed', 'Skipped', 'Recipients', '+ CTA', 'Rate'].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-medium" style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedOccasions.map(o => (
                      <tr key={o.occasion} style={{ borderBottom: '1px solid hsl(var(--border)/0.5)' }}>
                        <td className="py-2 px-2 font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                          {OCCASION_LABELS[o.occasion] ?? o.occasion}
                        </td>
                        <td className="py-2 px-2" style={{ color: 'hsl(var(--foreground))' }}>{o.total.toLocaleString()}</td>
                        <td className="py-2 px-2" style={{ color: 'hsl(var(--success))' }}>{o.sent.toLocaleString()}</td>
                        <td className="py-2 px-2" style={{ color: o.failed > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--muted-foreground))' }}>{o.failed.toLocaleString()}</td>
                        <td className="py-2 px-2" style={{ color: 'hsl(var(--muted-foreground))' }}>{o.skipped.toLocaleString()}</td>
                        <td className="py-2 px-2" style={{ color: 'hsl(var(--foreground))' }}>{o.uniqueRecipients.toLocaleString()}</td>
                        <td className="py-2 px-2" style={{ color: 'hsl(var(--accent))' }}>{o.plusCtaCount.toLocaleString()}</td>
                        <td className="py-2 px-2" style={{ color: 'hsl(var(--foreground))' }}>
                          {o.deliveryRate !== null ? `${o.deliveryRate}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p style={{ ...subStyle, marginTop: '0.75rem', fontStyle: 'italic' }}>
                Delivery rate = sent ÷ total attempts. Does not confirm inbox delivery or open tracking.
              </p>
            </div>
          )}

          {/* Send trend */}
          {data.trend.length > 0 && (
            <div style={cardStyle}>
              <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>Daily Send Trend</p>
              <div className="overflow-x-auto">
                <div className="flex items-end gap-1" style={{ minWidth: `${data.trend.length * 20}px`, height: '80px' }}>
                  {(() => {
                    const maxTotal = Math.max(...data.trend.map(d => d.total), 1);
                    return data.trend.map(d => (
                      <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.day}: ${d.total} total, ${d.sent} sent, ${d.failed} failed`}>
                        <div className="w-full rounded-t-sm" style={{
                          height: `${Math.max(4, Math.round((d.total / maxTotal) * 72))}px`,
                          background: d.failed > 0 ? 'hsl(var(--destructive)/0.7)' : 'hsl(var(--primary)/0.7)',
                        }} />
                      </div>
                    ));
                  })()}
                </div>
                <div className="flex justify-between mt-1">
                  <span style={subStyle}>{data.trend[0]?.day}</span>
                  <span style={subStyle}>{data.trend[data.trend.length - 1]?.day}</span>
                </div>
              </div>
              <p style={{ ...subStyle, marginTop: '0.5rem' }}>
                Gold = all sent · Red = any failures that day
              </p>
            </div>
          )}

          {/* Consent breakdown */}
          <div style={cardStyle}>
            <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>Marketing Consent</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p style={labelStyle}>Any consent record</p>
                <p style={valueStyle}>{data.consent.totalWithAnyConsent.toLocaleString()}</p>
                <p style={subStyle}>members with ≥1 category</p>
              </div>
              <div>
                <p style={labelStyle}>All 5 categories opted in</p>
                <p style={valueStyle}>{data.consent.totalAllOptedIn.toLocaleString()}</p>
                <p style={subStyle}>fully consented members</p>
              </div>
            </div>
            {data.consent.categories.length > 0 ? (
              <div className="space-y-2">
                {data.consent.categories.map(c => {
                  const total = c.optedIn + c.optedOut;
                  const pct = total > 0 ? Math.round((c.optedIn / total) * 100) : 0;
                  return (
                    <div key={c.category}>
                      <div className="flex justify-between mb-0.5">
                        <span style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)', fontSize: '0.8rem' }}>
                          {CONSENT_LABELS[c.category] ?? c.category}
                        </span>
                        <span style={subStyle}>{c.optedIn.toLocaleString()} opted in ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'hsl(var(--muted))' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'hsl(var(--primary))' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p style={subStyle}>No consent records yet — they populate as members sign up and set preferences.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Security & Trust tab ─────────────────────────────────────────────────────

interface SecurityData {
  fetchedAt: string;
  auth: { eventsLast24h: number };
  roles: { changesLast7d: { action: string; count: number }[] };
  deletion: { pendingCount: number; oldestRequestedAt: string | null };
  blocks: { total: number };
  moderation: { openReports: number; reportsLast7d: number };
  email: { optOutsLast30d: number };
  sessions: { activeApprox: number };
  accounts: { newLast24h: number; suspended: number };
  ownerSeed: { attemptsLast7d: number; retired: boolean };
}

const secCardStyle: React.CSSProperties = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0.75rem',
  padding: '1.25rem',
};
const secLabelStyle: React.CSSProperties = { color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)', fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' };
const secValueStyle: React.CSSProperties = { color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: 700, lineHeight: 1.1 };
const secSubStyle: React.CSSProperties = { color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)', fontSize: '0.72rem', marginTop: '0.2rem' };

function SecurityTrustTab() {
  const [data, setData] = useState<SecurityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/command-center/security')
      .then(r => r.json())
      .then((d: SecurityData & { error?: string }) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError('Failed to load security data'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const cardStyle = secCardStyle;
  const labelStyle = secLabelStyle;
  const valueStyle = secValueStyle;
  const subStyle = secSubStyle;

  const roleChangesTotal = data?.roles.changesLast7d.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
            Security &amp; Trust
          </h2>
          <p className="text-sm mt-0.5" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
            {data?.fetchedAt ? `Updated ${new Date(data.fetchedAt).toLocaleTimeString()}` : 'Loading…'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2 text-xs">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg p-3 text-sm" style={{ background: 'hsl(var(--destructive)/0.1)', border: '1px solid hsl(var(--destructive)/0.3)', color: 'hsl(var(--destructive))', fontFamily: 'var(--font-sans)' }}>
          {error}
        </div>
      )}

      {/* Owner-seed retirement status — always shown */}
      <div style={{ ...cardStyle, borderColor: data?.ownerSeed.retired ? 'hsl(var(--success)/0.4)' : 'hsl(var(--destructive)/0.4)' }}>
        <div className="flex items-center gap-2 mb-2">
          {data?.ownerSeed.retired
            ? <CheckCircle2 className="w-4 h-4" style={{ color: 'hsl(var(--success))' }} />
            : <XCircle className="w-4 h-4" style={{ color: 'hsl(var(--destructive))' }} />}
          <p style={{ ...labelStyle, textTransform: 'none', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
            P0 Fix — Owner-seed endpoint
          </p>
        </div>
        <p style={subStyle}>
          {loading ? 'Checking…' : data?.ownerSeed.retired
            ? 'Retired. Returns 410 Gone unconditionally. Owner provisioning must be done via direct DB operation.'
            : 'WARNING: Endpoint may still be active. Investigate immediately.'}
        </p>
        {(data?.ownerSeed.attemptsLast7d ?? 0) > 0 && (
          <p className="mt-1 text-xs font-semibold" style={{ color: 'hsl(var(--destructive))', fontFamily: 'var(--font-sans)' }}>
            ⚠ {data!.ownerSeed.attemptsLast7d} attempt(s) logged in last 7 days — investigate audit log
          </p>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { label: 'Auth events (24h)', value: data?.auth.eventsLast24h, sub: 'login/logout/reset', alert: false },
          { label: 'Role changes (7d)', value: roleChangesTotal, sub: 'grants + revocations', alert: roleChangesTotal > 5 },
          { label: 'Pending deletions', value: data?.deletion.pendingCount, sub: data?.deletion.oldestRequestedAt ? `oldest: ${new Date(data.deletion.oldestRequestedAt).toLocaleDateString()}` : 'none pending', alert: (data?.deletion.pendingCount ?? 0) > 0 },
          { label: 'Open reports', value: data?.moderation.openReports, sub: `${data?.moderation.reportsLast7d ?? 0} filed last 7d`, alert: (data?.moderation.openReports ?? 0) > 10 },
          { label: 'Active blocks', value: data?.blocks.total, sub: 'mutual block pairs', alert: false },
          { label: 'Email opt-outs (30d)', value: data?.email.optOutsLast30d, sub: 'marketing unsubscribes', alert: false },
          { label: 'Active sessions', value: data?.sessions.activeApprox, sub: 'approx (30d window)', alert: false },
          { label: 'New accounts (24h)', value: data?.accounts.newLast24h, sub: 'verified signups', alert: false },
          { label: 'Suspended accounts', value: data?.accounts.suspended, sub: 'banned or deletion-queued', alert: (data?.accounts.suspended ?? 0) > 0 },
        ].map(item => (
          <div key={item.label} style={{ ...cardStyle, borderColor: item.alert ? 'hsl(var(--warning)/0.5)' : 'hsl(var(--border))' }}>
            <p style={labelStyle}>{item.label}</p>
            {loading ? <Skeleton className="h-8 w-16 mt-1" /> : (
              <p style={{ ...valueStyle, color: item.alert ? 'hsl(var(--warning))' : 'hsl(var(--foreground))' }}>
                {item.value?.toLocaleString() ?? '—'}
              </p>
            )}
            <p style={subStyle}>{item.sub}</p>
          </div>
        ))}
      </div>

      {/* Role changes breakdown */}
      {(data?.roles.changesLast7d.length ?? 0) > 0 && (
        <div style={cardStyle}>
          <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>Role Changes (last 7 days)</p>
          <div className="space-y-2">
            {data!.roles.changesLast7d.map(r => (
              <div key={r.action} className="flex items-center justify-between">
                <span style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)', fontSize: '0.85rem' }}>
                  {r.action}
                </span>
                <Badge variant="outline" style={{ fontFamily: 'var(--font-sans)', fontSize: '0.75rem' }}>
                  {r.count}
                </Badge>
              </div>
            ))}
          </div>
          <p style={{ ...subStyle, marginTop: '0.5rem' }}>
            Review the Logs tab for full audit trail with actor, target, and reason.
          </p>
        </div>
      )}

      {/* Block-check fail-closed status */}
      <div style={cardStyle}>
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="w-4 h-4" style={{ color: 'hsl(var(--success))' }} />
          <p style={{ ...labelStyle, textTransform: 'none', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--foreground))' }}>
            P0 Fix — Block-check fail-closed
          </p>
        </div>
        <p style={subStyle}>
          All 10 callers of isBlocked / getBlockedUserIds now return 503 when the database is unavailable,
          rather than silently exposing protected profiles, messages, or presence data.
        </p>
      </div>

      {/* Owner action required */}
      <div style={{ ...cardStyle, borderColor: 'hsl(var(--warning)/0.4)' }}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4" style={{ color: 'hsl(var(--warning))' }} />
          <p style={{ ...labelStyle, textTransform: 'none', fontSize: '0.8rem', fontWeight: 700, color: 'hsl(var(--warning))' }}>
            Owner Action Required — App Store Preflight
          </p>
        </div>
        <div className="space-y-2">
          {[
            { item: 'A. Build / Distribution', note: 'Populate app-store-connect env group in Codemagic; trigger clean CI build; install signed IPA via TestFlight on physical devices.' },
            { item: 'B. Apple Sign-In (SIWA)', note: 'Add APPLE_CLIENT_ID, APPLE_CLIENT_SECRET, APPLE_ROOT_CA_G3_FINGERPRINT to Settings → Secrets.' },
            { item: 'C. In-App Purchase', note: 'Create com.spellful.plus.monthly product in App Store Connect; complete Apple portal tasks A–E.' },
            { item: 'D. Privacy Policy', note: 'Replace draft with legally reviewed policy at spellful.com/privacy. Verify live URL before submission.' },
            { item: 'E. App Store Connect declarations', note: 'Complete privacy nutrition label accurately. Do not claim "no data collected" — the app collects account, usage, and purchase data.' },
            { item: 'F. GitHub sync (iPhone)', note: 'Safari → github.com → Settings → Authorized OAuth Apps → revoke Airo → reconnect.' },
          ].map(({ item, note }) => (
            <div key={item} className="flex gap-2">
              <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'hsl(var(--warning))' }} />
              <div>
                <p className="text-xs font-semibold" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-sans)' }}>{item}</p>
                <p style={subStyle}>{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const { session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  // Listen for internal navigation events (e.g. from the email status mini-card)
  useEffect(() => {
    function handleNav(e: Event) {
      const tab = (e as CustomEvent<string>).detail as TabId;
      if (TABS.some(t => t.id === tab)) setActiveTab(tab);
    }
    window.addEventListener('cc:navigate', handleNav);
    return () => window.removeEventListener('cc:navigate', handleNav);
  }, []);

  // Owner or admin guard
  const user = session?.user as { platformRole?: string } | undefined;
  const role = user?.platformRole;
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';

  if (isPending) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'hsl(var(--primary))' }} />
      </main>
    );
  }

  if (!session || !isOwnerOrAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  function renderTab() {
    switch (activeTab) {
      case 'dashboard':    return <DashboardTab />;
      case 'integrations': return <IntegrationsTab />;
      case 'help':         return <HelpTab />;
      case 'members':
        return <MembersTab />;
      case 'community':
        return <CommunityTab />;
      case 'messaging':
        return <MessagingTab />;
      case 'monetization':
        return <MonetizationTab />;
      case 'logs': return <LogsTab />;
      case 'settings':
        return <SettingsTab />;
      case 'email': return <EmailMarketingTab />;
      case 'security': return <SecurityTrustTab />;
      default: return null;
    }
  }

  return (
    <>
      <Helmet>
        <title>Command Center — Spellful Owner</title>
        <meta name="description" content="Owner-only command center for Spellful platform management." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen" style={{ background: 'hsl(var(--background))' }}>
        <h1 className="sr-only">{cc.title}</h1>
        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <div
          className="sticky top-0 z-40 px-4 py-3 flex items-center gap-3"
          style={{ background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'hsl(var(--primary) / 0.15)' }}>
              <Crown className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-tight truncate" style={{ color: 'hsl(var(--foreground))', fontFamily: 'var(--font-heading)' }}>
                {cc.title}
              </p>
              <p className="text-xs leading-tight" style={{ color: 'hsl(var(--muted-foreground))', fontFamily: 'var(--font-sans)' }}>
                {cc.subtitle}
              </p>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1" style={{ color: 'hsl(var(--primary))', borderColor: 'hsl(var(--primary) / 0.4)' }}>
              <Shield className="w-3 h-3" />
              Owner
            </Badge>
            <Link to="/admin/dashboard">
              <Button size="sm" variant="ghost" className="text-xs gap-1">
                <Activity className="w-3.5 h-3.5" />
                Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Tab bar ──────────────────────────────────────────────────────── */}
        <div
          className="sticky top-[52px] z-30 overflow-x-auto"
          style={{ background: 'hsl(var(--card))', borderBottom: '1px solid hsl(var(--border))' }}
        >
          <div className="flex min-w-max px-2">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-colors relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{
                    color: active ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                    fontFamily: 'var(--font-sans)',
                  }}
                  aria-selected={active}
                  role="tab"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {tab.label}
                  {active && (
                    <motion.div
                      layoutId="cc-tab-indicator"
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                      style={{ background: 'hsl(var(--primary))' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Tab content ──────────────────────────────────────────────────── */}
        <div className="max-w-5xl mx-auto px-4 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {renderTab()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Bottom nav spacer for mobile ─────────────────────────────────── */}
        <div className="h-24" aria-hidden="true" />
      </main>
    </>
  );
}
