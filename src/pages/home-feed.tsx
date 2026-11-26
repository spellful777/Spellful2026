import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { useCommunityPosts } from '@/hooks/useCommunity';
import { COMMUNITY_FEED, COMMUNITY_GROUPS, COMMUNITY_UPDATES } from '@/lib/community-navigation';
import { PostCard } from './community/index';

export default function HomeFeed() {
  const [filter, setFilter] = useState<'following' | 'discover'>('following');
  const [page, setPage] = useState(1);
  const [newPosts, setNewPosts] = useState(false);
  const anchor = useRef<{ id: string; top: number; scrollY: number } | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const { posts, loading, error, reload, pages, newestId } = useCommunityPosts(filter, undefined, page, 'newest');

  useEffect(() => {
    setNewPosts(false);
    if (newestId === undefined || loading || error) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        if (!document.hidden) {
          const params = new URLSearchParams({ filter, afterId: String(newestId) });
          const response = await fetch(`/api/community/posts?${params}`, { signal: controller.signal });
          if (response.ok) {
            const data = await response.json() as { hasNewPosts?: boolean };
            if (!controller.signal.aborted && data.hasNewPosts) {
              setNewPosts(true);
              return;
            }
          }
        }
      } catch { /* Keep the current feed available while checking for updates. */ }
      if (!controller.signal.aborted) timer = setTimeout(check, 45_000);
    }
    timer = setTimeout(check, 45_000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [filter, newestId, loading, error]);

  useEffect(() => {
    if (loading || !anchor.current) return;
    const previous = anchor.current;
    anchor.current = null;
    const card = list.current?.querySelector(`[data-feed-post-id="${previous.id}"]`);
    if (card) window.scrollBy(0, card.getBoundingClientRect().top - previous.top);
    else window.scrollTo(0, previous.scrollY);
  }, [loading]);

  function refresh() {
    const card = Array.from(list.current?.querySelectorAll<HTMLElement>('[data-feed-post-id]') ?? [])
      .find(item => item.getBoundingClientRect().bottom > 0);
    anchor.current = {
      id: card?.dataset.feedPostId ?? '',
      top: card?.getBoundingClientRect().top ?? 0,
      scrollY: window.scrollY,
    };
    setNewPosts(false);
    if (page !== 1) setPage(1);
    else reload();
  }

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-8">
      <Helmet><title>Home feed | Spellful</title><meta name="robots" content="noindex" /></Helmet>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl">Home</h1>
        <Button asChild><Link to="/community/new">Create post</Link></Button>
      </div>
      <section aria-labelledby="home-coven-heading" className="rounded-xl border border-border bg-card p-4">
        <h2 id="home-coven-heading" className="font-heading text-xl">My Coven</h2>
        <p className="mt-1 text-sm text-muted-foreground">Catch up with people you follow or join a group discussion.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm"><Link to={COMMUNITY_FEED}>Open My Coven feed</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to={COMMUNITY_UPDATES}>See updates</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to={COMMUNITY_GROUPS}>Browse groups</Link></Button>
        </div>
      </section>
      <nav aria-label="Home feed" className="flex flex-wrap gap-2">
        {(['following', 'discover'] as const).map(option => (
          <Button key={option} variant={filter === option ? 'default' : 'outline'} aria-pressed={filter === option} onClick={() => {
            setFilter(option);
            setPage(1);
          }}>
            {option === 'following' ? 'Following' : 'Discover'}
          </Button>
        ))}
        <Button asChild variant="ghost"><Link to="/community/discover">Find members</Link></Button>
      </nav>
      {newPosts && <div className="sticky top-16 z-20"><Button onClick={refresh}>New posts</Button></div>}
      {error ? (
        <div role="status" className="rounded-xl border border-border p-4">
          <p>Couldn’t load your feed.</p>
          <Button className="mt-2" variant="outline" onClick={reload}>Try again</Button>
        </div>
      ) : (
        <div ref={list} className="space-y-3" aria-busy={loading}>
          {(!loading || anchor.current) && posts.map(post => <PostCard key={post.id} post={post} />)}
          {loading && !anchor.current && <p role="status">Loading posts…</p>}
          {!loading && !posts.length && (
            <p role="status">{filter === 'following' ? 'Follow members to see their posts here.' : 'No new conversations to discover yet.'}</p>
          )}
        </div>
      )}
      {!loading && !error && pages > 1 && (
        <nav aria-label="Feed pages" className="flex items-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {pages}</span>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </nav>
      )}
    </main>
  );
}
