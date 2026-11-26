import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Bookmark, Heart } from 'lucide-react';
import SparkCard from '@/components/SparkCard';
import type { CommunityPost } from '@/hooks/useCommunity';

type Kind = 'favorite' | 'saved';
type Result = { counts: Record<Kind, number>; posts?: CommunityPost[] };
export function GrimoireSparks({ kind }: { kind?: Kind }) {
  const [data, setData] = useState<Result | null>(null);
  const [undo, setUndo] = useState<CommunityPost | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [error, setError] = useState('');
  const timer = useRef<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/community/spark-collections' + (kind ? '?kind=' + kind + '&page=' + page : ''), { signal: abort.signal })
      .then(r => { if (!r.ok) throw Error(); return r.json() as Promise<Result>; })
      .then(result => { if (!abort.signal.aborted) setData(result); })
      .catch(() => { if (!abort.signal.aborted) setError('Couldn’t load your Spark collections.'); });
    return () => abort.abort();
  }, [kind, page]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  function remove(post: CommunityPost, likeCount?: number) {
    setData(current => current && kind ? {
      counts: { ...current.counts, [kind]: Math.max(0, current.counts[kind] - 1) },
      posts: current.posts?.filter(item => item.id !== post.id),
    } : current);
    if (kind === 'favorite') {
      window.clearTimeout(timer.current);
      setUndo({ ...post, likeCount: likeCount ?? post.likeCount });
      timer.current = window.setTimeout(() => setUndo(null), 6000);
    }
  }
  async function restore() {
    if (!undo || undoing) return;
    const item = undo;
    setUndoing(true);
    setError('');
    try {
      const response = await fetch('/api/community/posts/' + item.id + '/like', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ liked: true }),
      });
      if (!response.ok) throw Error();
      const result = await response.json();
      setData(current => current && {
        counts: { ...current.counts, favorite: current.counts.favorite + 1 },
        posts: [{ ...item, ...result }, ...(current.posts ?? []).filter(post => post.id !== item.id)],
      });
      window.clearTimeout(timer.current);
      setUndo(null);
    } catch { setError('Couldn’t restore that Favorite.'); }
    finally { setUndoing(false); }
  }
  if (!kind) return <nav aria-label="Private Spark collections" className="mx-auto grid max-w-xl grid-cols-2 gap-2 px-4 py-3">
    {(['favorite', 'saved'] as const).map(item => {
      const Icon = item === 'favorite' ? Heart : Bookmark;
      const label = item === 'favorite' ? 'Favorite Sparks' : 'Saved Sparks';
      return <Link key={item} to={'/grimoire?sparks=' + item}
        aria-label={data ? label + ', ' + data.counts[item] + ' Sparks' : label}
        className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-sm">
        <Icon size={17} aria-hidden="true" /><span>{label}</span>{data && <span>{data.counts[item]}</span>}
      </Link>;
    })}
  </nav>;
  return <main className="mx-auto min-h-screen max-w-xl space-y-2 px-4 pb-24 pt-4">
    <Link className="text-sm text-muted-foreground" to="/grimoire">← Grimoire</Link>
    <h1 className="font-heading text-2xl">{kind === 'favorite' ? 'Favorite Sparks' : 'Saved Sparks'}</h1>
    {undo && <p className="flex items-center gap-4 rounded bg-card px-3" role="status">Favorite removed
      <button type="button" className="min-h-11 text-primary" disabled={undoing} onClick={restore}>Undo</button></p>}
    {error && <p role="alert">{error}</p>}
    {!data && !error && <p>Loading…</p>}
    {data?.posts?.map(post => <SparkCard key={post.id} post={post}
      onFavorite={reaction => {
        if (kind === 'favorite' && !reaction.liked) remove(post, reaction.likeCount);
        else setData(current => current && { ...current, posts: current.posts?.map(item => item.id === post.id ? { ...item, ...reaction } : item) });
      }}
      onSave={saved => {
        if (kind === 'saved' && !saved) remove(post);
        else setData(current => current && { ...current, posts: current.posts?.map(item => item.id === post.id ? { ...item, bookmarked: saved } : item) });
      }} />)}
    {data && !data.posts?.length && <p>No Sparks in this collection.</p>}
    {data && <div className="flex gap-3">
      {page > 1 && <button onClick={() => setPage(value => value - 1)}>Previous</button>}
      {page * 24 < data.counts[kind] && <button onClick={() => setPage(value => value + 1)}>Next</button>}
    </div>}
  </main>;
}
