/**
 * /account/security — Password, sessions, account deletion
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { useSession } from '@/lib/auth/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  ChevronLeft, Eye, EyeOff, Monitor, Trash2, AlertTriangle, ChevronDown, ChevronUp,
} from 'lucide-react';
import { account as pg } from 'virtual:content';

interface SessionRow {
  id: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  isCurrent?: boolean;
}

interface PasswordForm { current: string; next: string; confirm: string; }

export default function SecurityPage() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  // Password
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwForm, setPwForm] = useState<PasswordForm>({ current: '', next: '', confirm: '' });
  const [showPw, setShowPw] = useState(false);
  const [pwStatus, setPwStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [pwError, setPwError] = useState('');

  // Sessions
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  // Account deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<'idle' | 'pending' | 'requested' | 'error'>('idle');
  const [deleteError, setDeleteError] = useState('');
  const [scheduledDeletion, setScheduledDeletion] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/account/sessions', { credentials: 'include' })
      .then((r) => r.json())
      .then((d: { sessions?: SessionRow[] }) => { setSessions(d.sessions ?? []); })
      .catch(() => {})
      .finally(() => setSessionsLoading(false));
  }, []);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    if (pwForm.next !== pwForm.confirm) { setPwError('New passwords do not match.'); return; }
    if (pwForm.next.length < 12) { setPwError('Password must be at least 12 characters.'); return; }
    setPwStatus('saving');
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      });
      if (res.ok) {
        setPwStatus('saved');
        setPwForm({ current: '', next: '', confirm: '' });
        setTimeout(() => { setPwStatus('idle'); setShowPasswordForm(false); }, 2000);
      } else {
        const d = await res.json().catch(() => ({})) as { message?: string; error?: string };
        setPwError(d.message ?? d.error ?? 'Failed to update password.');
        setPwStatus('error');
      }
    } catch {
      setPwError('Network error. Please try again.');
      setPwStatus('error');
    }
  }

  async function revokeSession(id: string) {
    setRevoking(id);
    try {
      await fetch(`/api/account/sessions/${id}`, { method: 'DELETE', credentials: 'include' });
      setSessions((s) => s.filter((x) => x.id !== id));
    } catch { /* silently ignore */ }
    finally { setRevoking(null); }
  }

  async function handleDeleteRequest(e: React.FormEvent) {
    e.preventDefault();
    setDeleteError('');
    setDeleteStatus('pending');
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePassword }),
        credentials: 'include',
      });
      const d = await res.json().catch(() => ({})) as { ok?: boolean; scheduledDeletionAt?: string; error?: string };
      if (res.ok && d.ok) {
        setDeleteStatus('requested');
        setScheduledDeletion(d.scheduledDeletionAt ?? null);
        setDeletePassword('');
        setShowDeleteConfirm(false);
      } else {
        setDeleteError(d.error ?? 'Failed to request deletion. Check your password.');
        setDeleteStatus('error');
      }
    } catch {
      setDeleteError('Network error. Please try again.');
      setDeleteStatus('error');
    }
  }

  async function handleCancelDeletion() {
    try {
      await fetch('/api/account/delete', { method: 'DELETE', credentials: 'include' });
      setDeleteStatus('idle');
      setScheduledDeletion(null);
    } catch { /* silently ignore */ }
  }

  if (!session?.user) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading…</p></main>;
  }

  return (
    <>
      <Helmet>
        <title>Security — Spellful</title>
        <meta name="description" content="Manage your Spellful account password, active sessions, and account deletion." />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="container mx-auto px-4 pt-4 pb-28 max-w-lg">
        {/* Back nav */}
        <button
          onClick={() => navigate('/account')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-5"
        >
          <ChevronLeft className="w-4 h-4" />
          Account
        </button>

        <h1 className="font-serif text-2xl font-semibold text-foreground mb-6">Security</h1>

        {/* ── Password ──────────────────────────────────────────────────────── */}
        <section className="mb-5">
          <button
            type="button"
            onClick={() => setShowPasswordForm((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-colors hover:border-primary/40"
            style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
          >
            <div className="text-left">
              <p className="text-sm font-medium text-foreground">{pg.securityTab.passwordSectionTitle}</p>
              <p className="text-xs text-muted-foreground">Update your account password</p>
            </div>
            {showPasswordForm ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
          </button>

          {showPasswordForm && (
            <form
              onSubmit={(e) => { void handlePasswordChange(e); }}
              className="mt-2 rounded-2xl border px-4 py-4 space-y-4"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="current-pw">{pg.securityTab.currentPasswordLabel}</Label>
                <div className="relative">
                  <Input
                    id="current-pw"
                    type={showPw ? 'text' : 'password'}
                    value={pwForm.current}
                    onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))}
                    className="bg-muted border-border pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pw">{pg.securityTab.newPasswordLabel}</Label>
                <Input
                  id="new-pw"
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.next}
                  onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
                  className="bg-muted border-border"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-pw">{pg.securityTab.confirmPasswordLabel}</Label>
                <Input
                  id="confirm-pw"
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
                  className="bg-muted border-border"
                  required
                />
              </div>
              {pwError && <p className="text-sm text-destructive">{pwError}</p>}
              <Button type="submit" disabled={pwStatus === 'saving'} className="bg-primary text-primary-foreground">
                {pwStatus === 'saving' ? 'Updating…' : pwStatus === 'saved' ? 'Updated ✓' : 'Update Password'}
              </Button>
            </form>
          )}
        </section>

        {/* ── Active sessions ───────────────────────────────────────────────── */}
        <section className="mb-5">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            {pg.securityTab.sessionsSectionTitle}
          </h2>
          <div
            className="rounded-2xl border overflow-hidden divide-y"
            style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
          >
            {sessionsLoading ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">Loading sessions…</p>
            ) : sessions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-muted-foreground">No active sessions found.</p>
            ) : (
              sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <Monitor className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground truncate">
                      {s.userAgent ? s.userAgent.slice(0, 60) : 'Unknown device'}
                      {s.isCurrent && (
                        <span
                          className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
                          style={{ background: 'hsl(var(--success)/0.15)', color: 'hsl(var(--success))' }}
                        >
                          Current
                        </span>
                      )}
                    </p>
                    {s.createdAt && (
                      <p className="text-xs text-muted-foreground">
                        Started {new Date(s.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {!s.isCurrent && (
                    <button
                      onClick={() => { void revokeSession(s.id); }}
                      disabled={revoking === s.id}
                      className="text-xs text-destructive hover:opacity-80 flex-shrink-0"
                    >
                      {revoking === s.id ? 'Revoking…' : 'Revoke'}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <Separator className="bg-border my-6" />

        {/* ── Account deletion ──────────────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">
            Danger Zone
          </h2>

          {deleteStatus === 'requested' ? (
            <div
              className="rounded-2xl border px-4 py-4 space-y-3"
              style={{ background: 'hsl(var(--destructive)/0.06)', borderColor: 'hsl(var(--destructive)/0.3)' }}
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Deletion scheduled</p>
                  {scheduledDeletion && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your account will be permanently deleted on{' '}
                      {new Date(scheduledDeletion).toLocaleDateString()}.
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { void handleCancelDeletion(); }}
                className="border-border"
              >
                Cancel deletion
              </Button>
            </div>
          ) : (
            <div
              className="rounded-2xl border px-4 py-4"
              style={{ background: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <Trash2 className="w-4 h-4 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Delete Account</p>
                  <p className="text-xs text-muted-foreground">
                    Schedules permanent deletion after a 30-day grace period.
                  </p>
                </div>
              </div>

              {!showDeleteConfirm ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-destructive border-destructive/40 hover:bg-destructive/10"
                >
                  Request account deletion
                </Button>
              ) : (
                <form onSubmit={(e) => { void handleDeleteRequest(e); }} className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Enter your password to confirm. You have 30 days to cancel.
                  </p>
                  <Input
                    type="password"
                    placeholder="Your current password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className="bg-muted border-border"
                    required
                  />
                  {deleteError && <p className="text-xs text-destructive">{deleteError}</p>}
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={deleteStatus === 'pending'}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteStatus === 'pending' ? 'Requesting…' : 'Confirm deletion'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setShowDeleteConfirm(false); setDeleteError(''); setDeletePassword(''); setDeleteStatus('idle'); }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
