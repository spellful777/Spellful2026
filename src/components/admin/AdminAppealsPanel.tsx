/**
 * AdminAppealsPanel — review and resolve moderation appeals.
 * Embedded in the community admin console.
 */
import { useState, useEffect } from 'react';
import { Scale, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface Appeal {
  id: number;
  targetType: string;
  targetId: number;
  reason: string;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  userName: string | null;
  userUsername: string | null;
}

export default function AdminAppealsPanel() {
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => { void load(); }, [statusFilter]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/community/appeals?status=${statusFilter}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { appeals: Appeal[] };
        setAppeals(data.appeals);
      }
    } finally {
      setLoading(false);
    }
  }

  async function resolve(id: number, status: 'accepted' | 'rejected') {
    setMsg('');
    const res = await fetch(`/api/admin/community/appeals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, adminNote: notes[id] ?? '' }),
    });
    if (res.ok) {
      setMsg(`Appeal ${status}.`);
      void load();
    }
  }

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-accent/10">
          <Scale className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>Moderation Appeals</h2>
          <p className="text-sm text-muted-foreground">Review and resolve member appeals</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="ml-auto text-muted-foreground">
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {msg && <div className="mb-4 p-3 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] text-sm">{msg}</div>}

      <div className="flex gap-2 mb-4">
        {['pending', 'accepted', 'rejected'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize', statusFilter === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'].join(' ')}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : appeals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No {statusFilter} appeals.</p>
      ) : (
        <div className="space-y-3">
          {appeals.map(appeal => (
            <div key={appeal.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button onClick={() => setExpanded(expanded === appeal.id ? null : appeal.id)}
                className="w-full text-left flex items-center gap-3 px-4 py-3">
                {expanded === appeal.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {appeal.userName ?? appeal.userUsername ?? 'Unknown'} — {appeal.targetType} #{appeal.targetId}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(appeal.createdAt), { addSuffix: true })}</p>
                </div>
              </button>
              {expanded === appeal.id && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                  <p className="text-sm text-foreground">{appeal.reason}</p>
                  {statusFilter === 'pending' && (
                    <>
                      <textarea
                        placeholder="Admin note (optional)"
                        value={notes[appeal.id] ?? ''}
                        onChange={e => setNotes(prev => ({ ...prev, [appeal.id]: e.target.value }))}
                        rows={2}
                        className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => resolve(appeal.id, 'accepted')} className="gap-1.5 bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/90 text-white">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => resolve(appeal.id, 'rejected')} className="gap-1.5">
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </div>
                    </>
                  )}
                  {appeal.adminNote && <p className="text-xs text-muted-foreground italic">{appeal.adminNote}</p>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
