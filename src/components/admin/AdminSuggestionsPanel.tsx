/**
 * AdminSuggestionsPanel — manage feature request status and staff responses.
 */
import { useState, useEffect } from 'react';
import { Lightbulb, RefreshCw, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

interface Suggestion {
  id: number;
  title: string;
  description: string;
  status: string;
  voteCount: number;
  staffResponse: string | null;
  createdAt: string;
  authorName: string | null;
}

const STATUSES = ['open', 'planned', 'in-progress', 'shipped', 'declined'];

export default function AdminSuggestionsPanel() {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('open');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [statusEdits, setStatusEdits] = useState<Record<number, string>>({});
  const [responseEdits, setResponseEdits] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');

  useEffect(() => { void load(); }, [filter]);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/community/suggestions?status=${filter}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { suggestions: Suggestion[] };
        setItems(data.suggestions);
      }
    } finally {
      setLoading(false);
    }
  }

  async function save(id: number) {
    setMsg('');
    const res = await fetch(`/api/admin/community/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        status: statusEdits[id],
        staffResponse: responseEdits[id],
      }),
    });
    if (res.ok) { setMsg('Saved.'); void load(); }
  }

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-secondary/10">
          <Lightbulb className="w-5 h-5 text-secondary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>Feature Requests</h2>
          <p className="text-sm text-muted-foreground">Manage suggestion status and staff responses</p>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="ml-auto text-muted-foreground"><RefreshCw className="w-4 h-4" /></Button>
      </div>

      {msg && <div className="mb-4 p-3 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] text-sm">{msg}</div>}

      <div className="flex gap-2 flex-wrap mb-4">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={['px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize', filter === s ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'].join(' ')}>
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No {filter} suggestions.</p>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                className="w-full text-left flex items-center gap-3 px-4 py-3">
                {expanded === item.id ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.voteCount} votes · {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}</p>
                </div>
              </button>
              {expanded === item.id && (
                <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Status</label>
                    <select
                      value={statusEdits[item.id] ?? item.status}
                      onChange={e => setStatusEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                      className="rounded-lg border border-border bg-muted px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Staff Response</label>
                    <textarea
                      value={responseEdits[item.id] ?? (item.staffResponse ?? '')}
                      onChange={e => setResponseEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    />
                  </div>
                  <Button size="sm" onClick={() => save(item.id)} className="gap-1.5">
                    <Check className="w-3.5 h-3.5" />Save
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
