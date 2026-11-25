/**
 * /account — Redesigned account hub
 * Compact user summary → Profile Studio card → grouped settings menu
 * Content values rendered inline (no prop-drilling) per content-layer rules.
 */
import { useNavigate, Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useSession, signOut } from '@/lib/auth/auth-client';
import { useEntitlement } from '@/lib/use-plus-entitlement';
import { SupporterBadge } from '@/components/SupporterBadge';
import {
  User, Wand2, Sparkles, Shield, Lock, Sliders,
  Star, Crown, LogOut, ChevronRight, FileText,
} from 'lucide-react';
import { account_hub as pg } from 'virtual:content';

// ── Shared layout primitives (no content props) ───────────────────────────────

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden divide-y"
      style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--card))' }}
    >
      {children}
    </div>
  );
}

function SettingsRowShell({ to, icon, children }: { to: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'hsl(var(--primary)/0.12)', color: 'hsl(var(--primary))' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
      <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AccountPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const { data: ent } = useEntitlement();

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  if (!session?.user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading…</p>
      </main>
    );
  }

  const user = session.user as {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    platformRole?: string;
    username?: string | null;
  };

  const isAdmin = user.platformRole === 'owner' || user.platformRole === 'admin';
  const isOwner = user.platformRole === 'owner';

  return (
    <>
      <Helmet>
        <title>My Account — Spellful</title>
        <meta name="description" content="Manage your Spellful account, profile, and settings." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="container mx-auto px-4 pt-6 pb-28 max-w-lg">

        <h1 className="sr-only">My Account</h1>

        {/* ── Compact user summary ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-5">
          {user.image ? (
            <img
              src={user.image}
              alt={user.name ?? pg.fallbackName}
              className="w-12 h-12 rounded-full object-cover border-2 flex-shrink-0"
              style={{ borderColor: 'hsl(var(--primary)/0.5)' }}
            />
          ) : (
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(var(--primary)/0.15)' }}
            >
              <User className="w-6 h-6" style={{ color: 'hsl(var(--primary))' }} />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate leading-tight">
              {user.name ?? pg.fallbackName}
            </p>
            {user.username && (
              <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
            )}
            {!user.username && user.email && (
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
            )}
          </div>
          {ent.isPlus && (
            <div className="ml-auto flex-shrink-0">
              <SupporterBadge size={18} />
            </div>
          )}
        </div>

        {/* ── Profile Studio flagship card ─────────────────────────────────── */}
        <Link
          to="/account/profile"
          className="block rounded-2xl border mb-6 overflow-hidden transition-colors hover:border-primary/60"
          style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--primary)/0.35)' }}
        >
          <div
            className="px-4 py-3 flex items-center gap-3"
            style={{ background: 'hsl(var(--primary)/0.08)', borderBottom: '1px solid hsl(var(--primary)/0.15)' }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'hsl(var(--primary)/0.18)' }}
            >
              <Wand2 className="w-5 h-5" style={{ color: 'hsl(var(--primary))' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>
                {pg.studioCard.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {pg.studioCard.subtitle}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
          </div>
          <div className="px-4 py-2.5">
            <p className="text-xs text-muted-foreground">
              {pg.studioCard.body}
            </p>
          </div>
        </Link>

        {/* ── Personalization ───────────────────────────────────────────────── */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">
            {pg.groups.personalization}
          </p>
          <SettingsGroup>
            <SettingsRowShell to="/account/edit-profile" icon={<User className="w-4 h-4" />}>
              <p className="text-sm font-medium text-foreground">{pg.rows.editProfile.label}</p>
              <p className="text-xs text-muted-foreground">{pg.rows.editProfile.desc}</p>
            </SettingsRowShell>
            <SettingsRowShell to="/account/astrology" icon={<Star className="w-4 h-4" />}>
              <p className="text-sm font-medium text-foreground">{pg.rows.astrology.label}</p>
              <p className="text-xs text-muted-foreground">{pg.rows.astrology.desc}</p>
            </SettingsRowShell>
          </SettingsGroup>
        </div>

        {/* ── Preferences ───────────────────────────────────────────────────── */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">
            {pg.groups.preferences}
          </p>
          <SettingsGroup>
            <SettingsRowShell to="/account/privacy" icon={<Shield className="w-4 h-4" />}>
              <p className="text-sm font-medium text-foreground">{pg.rows.privacy.label}</p>
              <p className="text-xs text-muted-foreground">{pg.rows.privacy.desc}</p>
            </SettingsRowShell>
            <SettingsRowShell to="/account/security" icon={<Lock className="w-4 h-4" />}>
              <p className="text-sm font-medium text-foreground">{pg.rows.security.label}</p>
              <p className="text-xs text-muted-foreground">{pg.rows.security.desc}</p>
            </SettingsRowShell>
            <SettingsRowShell to="/account/accessibility" icon={<Sliders className="w-4 h-4" />}>
              <p className="text-sm font-medium text-foreground">{pg.rows.accessibility.label}</p>
              <p className="text-xs text-muted-foreground">{pg.rows.accessibility.desc}</p>
            </SettingsRowShell>
          </SettingsGroup>
        </div>

        {/* ── Account ───────────────────────────────────────────────────────── */}
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-1.5">
            {pg.groups.account}
          </p>
          <SettingsGroup>
            <SettingsRowShell to="/account/account-type" icon={<Sparkles className="w-4 h-4" />}>
              <p className="text-sm font-medium text-foreground">
                {ent.isPlus ? pg.rows.accountTypePlus.label : pg.rows.accountType.label}
              </p>
              <p className="text-xs text-muted-foreground">
                {ent.isPlus ? pg.rows.accountTypePlus.desc : pg.rows.accountType.desc}
              </p>
            </SettingsRowShell>

            {isAdmin && (
              <SettingsRowShell to="/admin/command-center" icon={<Crown className="w-4 h-4" />}>
                <p className="text-sm font-medium text-foreground">{pg.rows.adminAccess.label}</p>
                <p className="text-xs text-muted-foreground">{pg.rows.adminAccess.desc}</p>
              </SettingsRowShell>
            )}

            {isAdmin && !isOwner && (
              <SettingsRowShell to="/account/applications" icon={<FileText className="w-4 h-4" />}>
                <p className="text-sm font-medium text-foreground">{pg.rows.myApplications.label}</p>
                <p className="text-xs text-muted-foreground">{pg.rows.myApplications.desc}</p>
              </SettingsRowShell>
            )}

            <button
              onClick={() => { void handleSignOut(); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors hover:bg-destructive/10 text-left"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'hsl(var(--destructive)/0.12)' }}
              >
                <LogOut className="w-4 h-4" style={{ color: 'hsl(var(--destructive))' }} />
              </div>
              <span className="text-sm font-medium" style={{ color: 'hsl(var(--destructive))' }}>
                {pg.signOut}
              </span>
            </button>
          </SettingsGroup>
        </div>

      </main>
    </>
  );
}
