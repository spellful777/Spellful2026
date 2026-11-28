import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Search } from 'lucide-react';
import type { CommunityCategory } from '@/hooks/useCommunity';

export function JoinForum({ forum, viewer, changed }: { forum: CommunityCategory; viewer?: string; changed: (joined: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  if (!viewer) return <Link className="forum-join" to={'/login?redirect=' + encodeURIComponent('/community/' + forum.slug)}>Join</Link>;
  async function update() {
    if (busy) return;
    setBusy(true); setError(false);
    try {
      const res = await fetch('/api/community/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: forum.id, joined: !forum.joined }) });
      if (!res.ok) throw Error();
      changed((await res.json()).joined);
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <button className="forum-join" disabled={busy} aria-pressed={!!forum.joined} onClick={update}>
    {error ? 'Retry' : forum.joined ? 'Joined' : 'Join'}</button>;
}

export function ForumDirectory({viewer}: {viewer?: string}) {
  const [forums, setForums] = useState<CommunityCategory[]>([]);
  const [state, setState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch('/api/community/categories', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error();
      const rows = await response.json();
      if (!controller.signal.aborted) { setForums(rows); setState('ready'); }
    }).catch(() => { if (!controller.signal.aborted) setState('error'); });
    return () => controller.abort();
  }, [retry]);
  const row = (f: CommunityCategory) => <article key={f.id} className="forum-row">
    <Link to={'/community/' + f.slug}><strong>{f.name}</strong><p>{f.description}</p><small>{f.postCount} posts</small></Link>
    <JoinForum forum={f} viewer={viewer} changed={joined => setForums(old => old.map(item => item.id === f.id ? {...item, joined} : item))} />
  </article>;
  const joined = forums.filter(f => f.joined);
  const matches = forums.filter(f => !f.joined && (f.name + ' ' + f.description).toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="forum-directory">
    {joined.length > 0 && <><h2>Joined forums</h2>{joined.map(row)}</>}
    <label><Search size={16}/><input type="search" aria-label="Search forums" placeholder="Search forums" value={search} onChange={e => setSearch(e.target.value)} /></label>
    <h2>Discover forums</h2>{matches.map(row)}
    {state === 'loading' && <p>Loading forums…</p>}
    {state === 'error' && <button onClick={() => setRetry(n => n + 1)}>Couldn’t load forums. Retry</button>}
    {state === 'ready' && !matches.length && <p>No matching forums.</p>}
  </section>;
}
