import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { useCommunityPosts } from '@/hooks/useCommunity';
import { COMMUNITY_FEED, HOME_EXPLORE } from '@/lib/community-navigation';
import HomeSocialMenu from '@/components/HomeSocialMenu';
import HomeCovenCard from '@/components/HomeCovenCard';
import { PostCard } from './community/index';

export default function HomeFeed({ username }: { username?: string | null }) {
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('feed') === 'explore' ? 'discover' : 'following';
  const [pagination, setPagination] = useState({ filter, page: 1 });
  const page = pagination.filter === filter ? pagination.page : 1;
  const setPage = (next: number) => setPagination({ filter, page: next });
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

  const visiblePosts = !error && (!loading || anchor.current) ? posts : [];

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-8">
      <Helmet><title>Home feed | Spellful</title><meta name="robots" content="noindex" /></Helmet>
      <HomeSocialMenu username={username} />
      <nav aria-label="Home feed" className="grid grid-cols-3 gap-2">
        <Button asChild className="min-h-11 px-1.5" variant={filter === 'following' ? 'default' : 'outline'}>
          <Link to="/" aria-current={filter === 'following' ? 'page' : undefined}>Following</Link>
        </Button>
        <Button asChild className="min-h-11 px-1.5" variant={filter === 'discover' ? 'default' : 'outline'}>
          <Link to={HOME_EXPLORE} aria-current={filter === 'discover' ? 'page' : undefined}>Explore</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 px-1.5"><Link to={COMMUNITY_FEED}>Community</Link></Button>
      </nav>
      {filter === 'discover' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <h2 className="font-medium text-foreground">Public posts</h2>
          <Link to="/community/discover" className="min-h-11 inline-flex items-center text-primary hover:underline">Find members</Link>
        </div>
      )}
      {newPosts && <div className="sticky top-16 z-20"><Button onClick={refresh}>New posts</Button></div>}
      <div ref={list} className="space-y-3" aria-busy={loading}>
        {error ? (
          <div role="status" className="rounded-xl border border-border p-4">
            <p>Couldn’t load your feed.</p>
            <Button className="mt-2" variant="outline" onClick={reload}>Try again</Button>
          </div>
        ) : (
          <>
            {visiblePosts.slice(0, 2).map(post => <PostCard key={post.id} post={post} />)}
            {loading && !anchor.current && <p role="status">Loading posts…</p>}
            {!loading && !posts.length && (
              <p role="status">{filter === 'following' ? 'Follow members to see their posts here.' : 'No public posts to explore yet.'}</p>
            )}
          </>
        )}
        <HomeCovenCard />
        {visiblePosts.slice(2).map(post => <PostCard key={post.id} post={post} />)}
      </div>
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
