/**
 * /community/help/report-a-bug
 * Member-facing bug report form + status tracker + Known Issues list.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bug, CheckCircle2, Clock, Wrench,
  ArrowLeft, RefreshCw, AlertTriangle, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSession } from '@/lib/auth/auth-client';
import { community_help_report_bug } from 'virtual:content';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BugReport {
  id: number;
  title: string;
  category: string;
  status: string;
  ticketRef: string;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface KnownIssue {
  id: number;
  knownIssueTitle: string;
  status: string;
  adminNote: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'display', label: 'Display / Visual' },
  { value: 'performance', label: 'Performance / Speed' },
  { value: 'account', label: 'Account / Profile' },
  { value: 'messaging', label: 'Messaging' },
  { value: 'community', label: 'Community / Forums' },
  { value: 'tarot', label: 'Tarot' },
  { value: 'astrology', label: 'Astrology' },
  { value: 'other', label: 'Other' },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  new: { label: 'Submitted', color: 'hsl(var(--info))', icon: <Clock className="w-3.5 h-3.5" /> },
  in_progress: { label: 'In Progress', color: 'hsl(var(--warning))', icon: <Wrench className="w-3.5 h-3.5" /> },
  resolved: { label: 'Resolved', color: 'hsl(var(--success))', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

function ago(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d} days ago`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function ReportABugPage() {
  const { session } = useSession();
  const isSignedIn = !!session?.user?.id;

  const [tab, setTab] = useState<'report' | 'my-reports' | 'known-issues'>('report');
  const [myReports, setMyReports] = useState<BugReport[]>([]);
  const [knownIssues, setKnownIssues] = useState<KnownIssue[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [loadingIssues, setLoadingIssues] = useState(false);

  // Form state
  const [category, setCategory] = useState('general');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [steps, setSteps] = useState('');
  const [expected, setExpected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketRef, setTicketRef] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (tab === 'my-reports' && isSignedIn) loadMyReports();
    if (tab === 'known-issues') loadKnownIssues();
  }, [tab, isSignedIn]);

  async function loadMyReports() {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/bug-reports', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { reports: BugReport[] };
        setMyReports(data.reports);
      }
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadKnownIssues() {
    setLoadingIssues(true);
    try {
      const res = await fetch('/api/bug-reports/known-issues');
      if (res.ok) {
        const data = await res.json() as { issues: KnownIssue[] };
        setKnownIssues(data.issues);
      }
    } finally {
      setLoadingIssues(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      const deviceInfo = `${navigator.userAgent.slice(0, 200)} | ${window.innerWidth}x${window.innerHeight}`;
      const res = await fetch('/api/bug-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title, description, category,
          stepsToReproduce: steps,
          expectedBehavior: expected,
          pageUrl: window.location.href,
          deviceInfo,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Submission failed');
      }
      const d = await res.json() as { ticketRef: string };
      setTicketRef(d.ticketRef);
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setTitle(''); setDescription(''); setSteps(''); setExpected('');
    setCategory('general'); setSubmitted(false); setTicketRef(''); setError('');
  }

  const TABS = [
    { id: 'report' as const, label: community_help_report_bug.tabs.report },
    ...(isSignedIn ? [{ id: 'my-reports' as const, label: community_help_report_bug.tabs.myReports }] : []),
    { id: 'known-issues' as const, label: community_help_report_bug.tabs.knownIssues },
  ];

  return (
    <>
      <Helmet>
        <title>{community_help_report_bug.meta.title}</title>
        <meta name="description" content={community_help_report_bug.meta.description} />
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className="min-h-screen py-8 px-4 max-w-3xl mx-auto">
        {/* Back link */}
        <Link to="/community/help/getting-started" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Help & Resources
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-destructive/10">
            <Bug className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
              {community_help_report_bug.heading}
            </h1>
            <p className="text-sm text-muted-foreground">{community_help_report_bug.subheading}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-border mb-6">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Report form ── */}
        {tab === 'report' && (
          <AnimatePresence mode="wait">
            {submitted ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 p-8 text-center"
              >
                <CheckCircle2 className="w-12 h-12 mx-auto mb-4" style={{ color: 'hsl(var(--success))' }} />
                <h2 className="text-xl font-bold text-foreground mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
                  Report Submitted
                </h2>
                <p className="text-muted-foreground mb-4">
                  Thank you for helping improve Spellful. Your ticket reference is:
                </p>
                <div className="inline-block px-4 py-2 rounded-lg bg-card border border-border font-mono text-lg font-bold text-primary mb-6">
                  {ticketRef}
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  Keep this reference to track your report status. We review all reports and will update the status as we investigate.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={resetForm} variant="outline">Submit Another</Button>
                  {isSignedIn && (
                    <Button onClick={() => { resetForm(); setTab('my-reports'); }}>
                      View My Reports
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {!isSignedIn && (
                  <div className="p-3 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span><Link to="/sign-in" className="text-primary hover:underline">Sign in</Link> to track your report status with a ticket reference.</span>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-sm">{error}</div>
                )}

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Issue Title <span className="text-destructive">*</span></label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Brief description of the issue"
                    maxLength={255}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Description <span className="text-destructive">*</span></label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What happened? What did you expect to happen?"
                    rows={4}
                    required
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Steps to Reproduce <span className="text-muted-foreground text-xs">(optional)</span></label>
                  <textarea
                    value={steps}
                    onChange={(e) => setSteps(e.target.value)}
                    placeholder="1. Go to...&#10;2. Click on...&#10;3. See error"
                    rows={3}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Expected Behavior <span className="text-muted-foreground text-xs">(optional)</span></label>
                  <textarea
                    value={expected}
                    onChange={(e) => setExpected(e.target.value)}
                    placeholder="What should have happened instead?"
                    rows={2}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Your browser and screen size will be captured automatically to help us reproduce the issue.
                </p>

                <Button type="submit" disabled={submitting || !title.trim() || !description.trim()} className="w-full">
                  {submitting ? 'Submitting…' : 'Submit Bug Report'}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        )}

        {/* ── My Reports ── */}
        {tab === 'my-reports' && (
          <div>
            <div className="flex justify-end mb-4">
              <Button variant="ghost" size="sm" onClick={loadMyReports} className="gap-1.5 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
            {loadingReports ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : myReports.length === 0 ? (
              <div className="text-center py-12">
                <Bug className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No bug reports yet.</p>
                <Button className="mt-4" onClick={() => setTab('report')}>Report a Bug</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {myReports.map((report) => {
                  const cfg = STATUS_CONFIG[report.status] ?? STATUS_CONFIG['new'];
                  return (
                    <div key={report.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-medium text-foreground">{report.title}</span>
                            <Badge variant="outline" className="text-[10px]">{report.category}</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>Ref: <span className="font-mono text-foreground">{report.ticketRef || '—'}</span></span>
                            <span>{ago(report.createdAt)}</span>
                          </div>
                          {report.adminNote && (
                            <p className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                              <span className="font-medium text-foreground">Staff note:</span> {report.adminNote}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium" style={{ color: cfg.color }}>
                          {cfg.icon}
                          {cfg.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Known Issues ── */}
        {tab === 'known-issues' && (
          <div>
            <div className="flex justify-end mb-4">
              <Button variant="ghost" size="sm" onClick={loadKnownIssues} className="gap-1.5 text-muted-foreground">
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </Button>
            </div>
            {loadingIssues ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}
              </div>
            ) : knownIssues.length === 0 ? (
              <div className="text-center py-12">
                <Sparkles className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No known issues at this time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {knownIssues.map((issue) => {
                  const cfg = STATUS_CONFIG[issue.status] ?? STATUS_CONFIG['new'];
                  return (
                    <div key={issue.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{issue.knownIssueTitle || 'Known Issue'}</p>
                          {issue.adminNote && (
                            <p className="text-xs text-muted-foreground mt-1">{issue.adminNote}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">Reported {ago(issue.createdAt)}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium" style={{ color: cfg.color }}>
                          {cfg.icon}
                          {cfg.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
