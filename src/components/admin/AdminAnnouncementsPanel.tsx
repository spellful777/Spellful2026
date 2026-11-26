/**
 * AdminAnnouncementsPanel — create and manage community announcements.
 */
import { useState, useEffect } from 'react';
import { Megaphone, Plus, Check, X, RefreshCw, Pin, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface Announcement {
  id: number;
  type: string;
  title: string;
  body: string;
  isPinned: boolean;
  isPublished: boolean;
  publishedAt: string | null;
  authorName: string | null;
}

const TYPES = ['announcement', 'whats-new', 'changelog', 'event'];

export default function AdminAnnouncementsPanel() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [msg, setMsg] = useState('');

  // New form
  const [newType, setNewType] = useState('announcement');
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);

  async function load() {
    setLoading(true);
    try {
      // Load all (including unpublished) via admin endpoint
      const res = await fetch('/api/community/announcements', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json() as { announcements: Announcement[] };
        setItems(data.announcements);
      }
    } finally {
      setLoading(false);
    }
  }

  async function createAnnouncement() {
    if (!newTitle.trim() || !newBody.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/community/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: newType, title: newTitle, body: newBody, isPublished: true }),
      });
      if (res.ok) {
        setShowNew(false); setNewTitle(''); setNewBody(''); setNewType('announcement');
        setMsg('Announcement published.');
        void load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(item: Announcement) {
    const res = await fetch(`/api/admin/community/announcements/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isPublished: !item.isPublished }),
    });
    if (res.ok) void load();
  }

  async function togglePinned(item: Announcement) {
    const res = await fetch(`/api/admin/community/announcements/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ isPinned: !item.isPinned }),
    });
    if (res.ok) void load();
  }

  return (
    <div className="mt-10 pt-8 border-t border-border">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
          <Megaphone className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-foreground" style={{ fontFamily: 'var(--font-heading)' }}>Announcements</h2>
          <p className="text-sm text-muted-foreground">Publish official updates and news</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={load} className="text-muted-foreground"><RefreshCw className="w-4 h-4" /></Button>
          <Button size="sm" onClick={() => setShowNew(v => !v)} className="gap-1.5"><Plus className="w-3.5 h-3.5" />New</Button>
        </div>
      </div>

      {msg && <div className="mb-4 p-3 rounded-lg border border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/10 text-[hsl(var(--success))] text-sm">{msg}</div>}

      {showNew && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <h3 className="text-sm font-medium text-foreground">New Announcement</h3>
          <select value={newType} onChange={e => setNewType(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input placeholder="Title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
          <textarea placeholder="Body" value={newBody} onChange={e => setNewBody(e.target.value)} rows={5}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y" />
          <div className="flex gap-2">
            <Button size="sm" onClick={createAnnouncement} disabled={saving} className="gap-1.5">
              <Check className="w-3.5 h-3.5" />{saving ? 'Saving…' : 'Publish'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowNew(false)}><X className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px]">{item.type}</Badge>
                  {item.publishedAt && <span>{formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => togglePinned(item)}
                  className={['p-1.5 rounded-lg transition-colors', item.isPinned ? 'text-primary' : 'text-muted-foreground hover:text-foreground'].join(' ')}
                  title={item.isPinned ? 'Unpin' : 'Pin'}>
                  <Pin className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => togglePublished(item)}
                  className={['text-xs px-2 py-1 rounded-md border transition-colors', item.isPublished ? 'border-[hsl(var(--success))]/30 text-[hsl(var(--success))] bg-[hsl(var(--success))]/10' : 'border-border text-muted-foreground'].join(' ')}>
                  {item.isPublished ? <><Eye className="w-3 h-3 inline mr-1" />Live</> : <><EyeOff className="w-3 h-3 inline mr-1" />Hidden</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
