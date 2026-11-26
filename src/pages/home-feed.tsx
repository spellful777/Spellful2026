import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { useCommunityPosts } from '@/hooks/useCommunity';
import { COMMUNITY_FEED, HOME_EXPLORE } from '@/lib/community-navigation';
import SparkItLink from '@/components/SparkItLink';
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
  const headerSpark = useRef<HTMLAnchorElement>(null);
  const floatingSparkLink = useRef<HTMLAnchorElement>(null);
  const [floatingSpark, setFloatingSpark] = useState(false);
  const { posts, loading, error, reload, pages, newestId } = useCommunityPosts(filter, undefined, page, 'newest', true, 'spark');

  useEffect(() => {
    const button = headerSpark.current;
    if (!button) return;
    const mobile = window.matchMedia('(max-width: 767px)');

    const update = () => {
      const show = mobile.matches && button.getBoundingClientRect().bottom <= 0;
      if (!show && floatingSparkLink.current && document.activeElement === floatingSparkLink.current) button.focus({ preventScroll: true });
      setFloatingSpark(show);
    };

    const observer = new IntersectionObserver(update);
    observer.observe(button);
    mobile.addEventListener('change', update);
    update();
    return () => {
      observer.disconnect();
      mobile.removeEventListener('change', update);
    };
  }, []);

  useEffect(() => {
    setNewPosts(false);
    if (newestId === undefined || loading || error) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function check() {
      try {
        if (!document.hidden) {
          const params = new URLSearchParams({ filter, kind: 'spark', afterId: String(newestId) });
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
    <main className="home-feed mx-auto max-w-3xl space-y-2 px-3 pb-[calc(8rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 md:pb-24">
      <Helmet><title>Home feed | Spellful</title><meta name="robots" content="noindex" /></Helmet>
      <HomeSocialMenu username={username} sparkRef={headerSpark} floatingSpark={floatingSpark} />
      <nav aria-label="Home feed" className="home-feed-tabs sticky top-0 z-30 grid grid-cols-3 md:top-20">
        <Link to="/" className="home-feed-link coven-press" aria-current={filter === 'following' ? 'page' : undefined}>Following</Link>
        <Link to={HOME_EXPLORE} className="home-feed-link coven-press" aria-current={filter === 'discover' ? 'page' : undefined}>Explore</Link>
        <Link to={COMMUNITY_FEED} className="home-feed-link coven-press">Community</Link>
      </nav>
      {newPosts && <Button onClick={refresh} size="sm">New posts</Button>}
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
              <p role="status">{filter === 'following' ? 'Follow members to see their Sparks here.' : 'No public Sparks to explore yet.'}</p>
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
      {floatingSpark && (
        <div className="home-floating-spark fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-[51] md:hidden">
          <SparkItLink iconOnly linkRef={floatingSparkLink} />
        </div>
      )}
    </main>
  );
}
