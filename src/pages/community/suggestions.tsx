/**
 * /community/suggestions
 * Feature requests with upvoting and status tracking.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lightbulb, ChevronUp, CheckCircle2, Clock, Rocket, XCircle,
  ArrowLeft, RefreshCw, Plus, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSession } from '@/lib/auth/auth-client.tsx';
import { community_suggestions as content } from 'virtual:content';

interface Suggestion {
  id: number;
  title: string;
  description: string;
  status: string;
  voteCount: number;
  staffResponse: string | null;
  staffResponseAt: string | null;
  createdAt: string;
  authorName: string | null;
  authorUsername: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactElement }> = {
  open: { label: 'Open', color: 'hsl(var(--muted-foreground))', icon: <Clock className="w-3.5 h-3.5" /> },
  planned: { label: 'Planned', color: 'hsl(var(--info))', icon: <Lightbulb className="w-3.5 h-3.5" /> },
  'in-progress': { label: 'In Progress', color: 'hsl(var(--warning))', icon: <Rocket className="w-3.5 h-3.5" /> },
  shipped: { label: 'Shipped', color: 'hsl(var(--success))', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  declined: { label: 'Declined', color: 'hsl(var(--destructive))', icon: <XCircle className="w-3.5 h-3.5" /> },
};

function ago(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  return `${d}d ago`;
}

export default function SuggestionsPage() {
  const { session } = useSession();
  const isSignedIn = !!session?.user?.id;

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [votedIds, setVotedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { void load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const url = filter ? `/api/community/suggestions?status=${filter}` : '/api/community/suggestions';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { suggestions: Suggestion[]; votedIds: number[] };
        setSuggestions(data.suggestions);
        setVotedIds(data.votedIds);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVote(id: number) {
    if (!isSignedIn) return;
    const res = await fetch(`/api/community/suggestions/${id}/vote`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const d = await res.json() as { voted: boolean };
      setVotedIds(prev => d.voted ? [...prev, id] : prev.filter(v => v !== id));
      setSuggestions(prev => prev.map(s =>
        s.id === id ? { ...s, voteCount: s.voteCount + (d.voted ? 1 : -1) } : s
      ));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || !newDesc.trim()) return;
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch('/api/community/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: newTitle, description: newDesc }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? 'Submission failed');
      }
      setNewTitle(''); setNewDesc(''); setShowForm(false);
      void load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const FILTERS = [
    { value: '', label: content.filterAll },
    { value: 'open', label: content.filterOpen },
    { value: 'planned', label: content.filterPlanned },
    { value: 'in-progress', label: content.filterInProgress },
    { value: 'shipped', label: content.filterShipped },
    { value: 'declined', label: content.filterDeclined },
  ];

  return (
    <>
      <Helmet>
        <title>{content.meta.title}</title>
        <meta name="description" content={content.meta.description} />
      </Helmet>

      <main className="min-h-screen py-8 px-4 max-w-3xl mx-auto">
        <Link to="/community" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Community
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/10">
            <Lightbulb className="w-5 h-5 text-secondary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>
              {content.heading}
            </h1>
            <p className="text-sm text-muted-foreground">{content.subheading}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={load} className="text-muted-foreground">
              <RefreshCw className="w-4 h-4" />
            </Button>
            {isSignedIn && (
              <Button size="sm" onClick={() => setShowForm(v => !v)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                {content.submitButton}
              </Button>
            )}
          </div>
        </div>

        {/* Submit form */}
        <AnimatePresence>
          {showForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmit}
              className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 overflow-hidden"
            >
              <h3 className="text-sm font-semibold text-foreground">{content.formHeading}</h3>
              {formError && <p className="text-xs text-destructive">{formError}</p>}
              <Input
                placeholder="Short summary of your idea"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                maxLength={255}
                required
              />
              <textarea
                placeholder="Describe the feature and why it would be useful"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                rows={3}
                required
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
              />
              <div className="flex gap-2">
                <Button size="sm" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : content.submitFormButton}</Button>
                <Button size="sm" variant="ghost" type="button" onClick={() => setShowForm(false)}>{content.cancelButton}</Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap mb-6">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                filter === f.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
          </div>
        ) : suggestions.length === 0 ? (
          <div className="text-center py-16">
            <Lightbulb className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium text-foreground mb-1">{content.emptyHeading}</p>
            <p className="text-sm text-muted-foreground">{content.emptyBody}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((s) => {
              const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG['open'];
              const hasVoted = votedIds.includes(s.id);
              const isExpanded = expanded === s.id;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-card overflow-hidden"
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* Vote button */}
                    <button
                      onClick={() => handleVote(s.id)}
                      disabled={!isSignedIn}
                      className={[
                        'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg border transition-colors shrink-0',
                        hasVoted
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:border-primary/50 hover:text-primary',
                        !isSignedIn ? 'opacity-50 cursor-default' : '',
                      ].join(' ')}
                      aria-label={hasVoted ? content.votedLabel : content.voteLabel}
                    >
                      <ChevronUp className="w-4 h-4" />
                      <span className="text-xs font-bold">{s.voteCount}</span>
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : s.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-foreground">{s.title}</span>
                          <span className="flex items-center gap-1 text-xs font-medium" style={{ color: cfg.color }}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{ago(s.createdAt)}</p>
                      </button>

                      {isExpanded && (
                        <div className="mt-3 space-y-2">
                          <p className="text-sm text-muted-foreground">{s.description}</p>
                          {s.staffResponse && (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                              <p className="text-xs font-medium text-primary flex items-center gap-1 mb-1">
                                <Sparkles className="w-3 h-3" />
                                {content.staffResponseLabel}
                              </p>
                              <p className="text-sm text-foreground">{s.staffResponse}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
