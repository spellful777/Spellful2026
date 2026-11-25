/**
 * /account/account-type — Account type, Plus status, creator status, admin access
 * Content values rendered inline (no prop-drilling) per content-layer rules.
 */
import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useSession } from '@/lib/auth/auth-client';
import { useEntitlement } from '@/lib/use-plus-entitlement';
import { SupporterBadge } from '@/components/SupporterBadge';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft, Crown, Sparkles, Shield, Star, FileText, Wand2, ChevronRight,
} from 'lucide-react';
import { account_type as pg } from 'virtual:content';

interface AppSummary {
  id: number;
  status: string;
  requestedAccountType: string;
  submittedAt: string;
}

export default function AccountTypePage() {
  const { data: session } = useSession();
  const navigate = useNavigate();
  const { data: ent } = useEntitlement();

  const [myApplication, setMyApplication] = useState<AppSummary | null>(null);
  const [appLoading, setAppLoading] = useState(true);

  useEffect(() => {
    fetch('/api/creator-applications', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { applications?: AppSummary[] }) => {
        setMyApplication(d.applications?.[0] ?? null);
      })
      .catch(() => {})
      .finally(() => setAppLoading(false));
  }, []);

  if (!session?.user) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading…</p></main>;
  }

  const user = session.user as {
    name?: string | null;
    platformRole?: string;
  };

  const isAdmin = user.platformRole === 'owner' || user.platformRole === 'admin';
  const isOwner = user.platformRole === 'owner';

  return (
    <>
      <Helmet>
        <title>Account Type — Spellful</title>
        <meta name="description" content="View your Spellful account type, Plus membership, creator status, and administrative access." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="container mx-auto px-4 pt-4 pb-28 max-w-lg">
        <button
          onClick={() => navigate('/account')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          {pg.backLabel}
        </button>

        <h1 className="font-serif text-2xl font-semibold text-foreground mb-6">{pg.title}</h1>

        {/* ── Membership status ─────────────────────────────────────────────── */}
        <section className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
            {pg.membership.groupLabel}
          </p>
          <div
            className="rounded-2xl border px-4 py-4"
            style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
          >
            {ent.isPlus ? (
              <div className="flex items-center gap-3">
                <SupporterBadge size={28} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>
                    {pg.membership.plusLabel}
                  </p>
                  {ent.expiresAt && (
                    <p className="text-xs text-muted-foreground">
                      Renews {new Date(ent.expiresAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <Link to="/plus">
                  <Button variant="outline" size="sm" className="border-border text-xs">
                    {pg.membership.viewBenefits}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'hsl(var(--muted))' }}
                >
                  <Star className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{pg.membership.communityLabel}</p>
                  <p className="text-xs text-muted-foreground">{pg.membership.communityDesc}</p>
                </div>
                <Link to="/plus">
                  <Button size="sm" className="bg-primary text-primary-foreground text-xs">
                    <Sparkles className="w-3.5 h-3.5 mr-1" />
                    {pg.membership.explorePlus}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* ── Creator application ───────────────────────────────────────────── */}
        {!appLoading && (
          <section className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              {pg.creator.groupLabel}
            </p>
            <div
              className="rounded-2xl border px-4 py-4"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
            >
              {myApplication ? (
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(var(--primary)/0.12)' }}
                  >
                    <Wand2 className="w-4 h-4" style={{ color: 'hsl(var(--primary))' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground capitalize">
                      {myApplication.requestedAccountType.replace('_', ' ')} application
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      Status: {myApplication.status} · Submitted {new Date(myApplication.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'hsl(var(--muted))' }}
                  >
                    <Wand2 className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{pg.creator.becomeLabel}</p>
                    <p className="text-xs text-muted-foreground">{pg.creator.becomeDesc}</p>
                  </div>
                  <Link to="/creator-application">
                    <Button variant="outline" size="sm" className="border-border text-xs">
                      {pg.creator.applyButton}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── Administrative access — admin/owner only ──────────────────────── */}
        {isAdmin && (
          <section className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mb-2">
              {pg.admin.groupLabel}
            </p>
            <div
              className="rounded-2xl border overflow-hidden"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--primary)/0.4)' }}
            >
              <div
                className="px-4 py-3 flex items-center gap-3"
                style={{ background: 'hsl(var(--primary)/0.08)', borderBottom: '1px solid hsl(var(--primary)/0.15)' }}
              >
                <Crown className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'hsl(var(--primary))' }}>
                    {isOwner ? pg.admin.ownerLabel : pg.admin.adminLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">{pg.admin.adminDesc}</p>
                </div>
              </div>
              <div className="px-4 py-3 space-y-2">
                <Link
                  to="/admin/command-center"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:border-primary/40 transition-colors"
                  style={{ background: 'hsl(var(--muted))' }}
                >
                  <Crown className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                  <span className="flex-1 text-sm font-medium text-foreground">{pg.admin.links[0].label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </Link>
                <Link
                  to="/admin/roles"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:border-primary/40 transition-colors"
                  style={{ background: 'hsl(var(--muted))' }}
                >
                  <Shield className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                  <span className="flex-1 text-sm font-medium text-foreground">{pg.admin.links[1].label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </Link>
                <Link
                  to="/admin/applications"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:border-primary/40 transition-colors"
                  style={{ background: 'hsl(var(--muted))' }}
                >
                  <FileText className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                  <span className="flex-1 text-sm font-medium text-foreground">{pg.admin.links[2].label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </Link>
                <Link
                  to="/admin/community"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border hover:border-primary/40 transition-colors"
                  style={{ background: 'hsl(var(--muted))' }}
                >
                  <Star className="w-4 h-4 flex-shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                  <span className="flex-1 text-sm font-medium text-foreground">{pg.admin.links[3].label}</span>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
