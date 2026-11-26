import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface SearchResult {
  posts: { id: number; title: string; authorName: string | null; categoryName: string | null }[];
  hasMore: boolean;
}

export default function CommunitySearchPage() {
  const [params, setParams] = useSearchParams();
  const query = (params.get('q') ?? '').trim();
  const tag = (params.get('tag') ?? '').trim();
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '', 10) || 1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setResult(null);
    setError('');
    if (!query && !tag) return;
    const controller = new AbortController();
    const search = new URLSearchParams({ q: query, tag, page: String(page) });
    fetch(`/api/community/search?${search}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) throw new Error('Sign in to search Coven.');
        if (!response.ok) throw new Error('Coven search couldn’t load.');
        return response.json() as Promise<SearchResult>;
      })
      .then(data => { if (!controller.signal.aborted) setResult(data); })
      .catch((failure: Error) => { if (!controller.signal.aborted) setError(failure.message); });
    return () => controller.abort();
  }, [query, tag, page, attempt]);

  function changePage(next: number) {
    const nextParams = new URLSearchParams(params);
    nextParams.set('page', String(next));
    setParams(nextParams);
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <Link to="/community" className="text-sm text-primary underline">Back to Coven</Link>
      <h1 className="text-2xl font-semibold">Search Coven</h1>
      <form className="flex flex-wrap items-end gap-2" onSubmit={event => {
        event.preventDefault();
        const value = String(new FormData(event.currentTarget).get('query') ?? '').trim();
        setParams(value ? { q: value } : {});
      }}>
        <label className="grow text-sm">
          Search posts
          <Input key={query} className="mt-1" name="query" defaultValue={query} maxLength={200} />
        </label>
        <Button type="submit">Search</Button>
      </form>
      {tag && <h2 className="font-semibold">Posts tagged #{tag}</h2>}
      {error ? (
        <div>
          <p role="status">{error}</p>
          {error === 'Sign in to search Coven.' ? (
            <Link className="text-primary underline" to={`/login?redirect=${encodeURIComponent(`/community/search?${params}`)}`}>Sign in</Link>
          ) : <Button className="mt-2" variant="outline" onClick={() => setAttempt(value => value + 1)}>Try again</Button>}
        </div>
      ) : result ? (
        <>
          {!result.posts.length && <p role="status">No matching posts.</p>}
          <ul className="space-y-2">
            {result.posts.map(post => (
              <li key={post.id} className="rounded-lg border border-border bg-card p-4">
                <Link className="font-semibold text-primary underline" to={`/community/post/${post.id}`}>{post.title}</Link>
                <p className="text-sm text-muted-foreground">{[post.authorName, post.categoryName].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
          {(page > 1 || result.hasMore) && (
            <nav aria-label="Search results pages" className="flex items-center gap-3">
              <Button variant="outline" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</Button>
              <span>Page {page}</span>
              <Button variant="outline" disabled={!result.hasMore} onClick={() => changePage(page + 1)}>Next</Button>
            </nav>
          )}
        </>
      ) : (query || tag) && <p role="status">Searching Coven…</p>}
    </main>
  );
}
