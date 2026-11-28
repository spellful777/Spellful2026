import { topicPath } from '@/lib/spark-topics';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { useCommunityPosts } from '@/hooks/useCommunity';
import { COMMUNITY_CONNECTIONS, COMMUNITY_GROUPS, HOME_EXPLORE, HOME_FEED } from '@/lib/community-navigation';
import SparkItLink from '@/components/SparkItLink';
import HomeSocialMenu from '@/components/HomeSocialMenu';
import HomeCovenCard from '@/components/HomeCovenCard';
import SparkCard from '@/components/SparkCard';

export default function HomeFeed({ username, visitor = false }: { username?: string | null; visitor?: boolean }) {
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
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => setKeyboard(Boolean(viewport && window.innerHeight - viewport.height > 100));
    viewport?.addEventListener('resize', update);
    return () => viewport?.removeEventListener('resize', update);
  }, []);
  const [scrolling, setScrolling] = useState(false);
  const [navHeight, setNavHeight] = useState(0);
  const { posts, loading, error, reload, pages, newestId } = useCommunityPosts(filter, undefined, page, 'newest', true, 'spark');

  useEffect(() => {
    const button = headerSpark.current;
    if (!button) return;
    const mobile = window.matchMedia('(max-width: 767px)');
    let stopTimer: ReturnType<typeof setTimeout> | undefined;
    const nav = document.querySelector('nav[data-home-palette]');
    const navObserver = nav ? new ResizeObserver(() => setNavHeight(nav.getBoundingClientRect().height)) : null;
    if (nav && navObserver) {
      setNavHeight(nav.getBoundingClientRect().height);
      navObserver.observe(nav);
    }

    const onScroll = () => {
      if (!mobile.matches) return;
      setScrolling(true);
      clearTimeout(stopTimer);
      stopTimer = setTimeout(() => setScrolling(false), 180);
    };

    const update = () => {
      const show = mobile.matches && button.getBoundingClientRect().bottom <= 0;
      if (!show && floatingSparkLink.current && document.activeElement === floatingSparkLink.current) button.focus({ preventScroll: true });
      setFloatingSpark(show);
    };

    const observer = new IntersectionObserver(update);
    observer.observe(button);
    mobile.addEventListener('change', update);
    window.addEventListener('scroll', onScroll, { passive: true });
    update();
    return () => {
      observer.disconnect();
      navObserver?.disconnect();
      clearTimeout(stopTimer);
      window.removeEventListener('scroll', onScroll);
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
    <main
      className="home-feed mx-auto min-h-[calc(100svh-4rem)] max-w-3xl space-y-2 px-3 pb-[calc(var(--home-mobile-nav-height)+4.75rem)] pt-3 sm:px-4 md:pb-24"
      style={{ '--home-mobile-nav-height': navHeight ? `${navHeight}px` : 'calc(57px + env(safe-area-inset-bottom))' } as CSSProperties}
    >
      <Helmet><title>Sparks | Spellful</title><meta name="robots" content="noindex" /></Helmet>
      <HomeSocialMenu visitor={visitor} username={username} sparkRef={headerSpark} floatingSpark={floatingSpark} />
      <nav aria-label="Home feed" className="home-feed-tabs sticky top-0 z-30 grid grid-cols-3 md:top-20">
        <Link to={HOME_FEED} className="home-feed-link coven-press" aria-current={filter === 'following' ? 'page' : undefined}>Following</Link>
        <Link to={HOME_EXPLORE} className="home-feed-link coven-press" aria-current={filter === 'discover' ? 'page' : undefined}>Explore</Link>
        <Link to={COMMUNITY_GROUPS} className="home-feed-link coven-press">Community</Link>
      </nav>
      {newPosts && <Button onClick={refresh} size="sm">New posts</Button>}
      <div ref={list} className="space-y-2" aria-busy={loading}>
        {error ? (
          <div role="status" className="rounded-xl border border-border p-4">
            <p>Couldn’t load your feed.</p>
            <Button className="mt-2" variant="outline" onClick={reload}>Try again</Button>
          </div>
        ) : (
          <>
            {visiblePosts.slice(0, 2).map(post => <SparkCard key={post.id} post={post} canInteract={!visitor} />)}
            {loading && !anchor.current && <p role="status">Loading posts…</p>}
            {!loading && !posts.length && (
              <section className="rounded-xl border border-border bg-card px-4 py-5">
                <h2 className="font-heading text-xl text-foreground">{filter === 'following' ? 'Your Following feed' : 'Explore Sparks'}</h2>
                <p role="status" className="mt-1 text-sm text-muted-foreground">
                  {filter === 'following' ? 'Sparks from your Coven and the people you follow appear here.' : 'No public Sparks to explore yet.'}
                </p>
                <Link className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-primary underline underline-offset-4"
                  to={filter === 'following' ? '/community/discover' : '/explore'}>
                  {filter === 'following' ? 'Find members' : 'Browse all topics'}
                </Link>
              </section>
            )}
          </>
        )}
        {!visitor && <HomeCovenCard to={COMMUNITY_CONNECTIONS} />}
        {visiblePosts.slice(2).map(post => <SparkCard key={post.id} post={post} canInteract={!visitor} />)}
      </div>
      {filter === 'discover' && <nav aria-label="Explore topics" className="flex flex-wrap items-center gap-x-3 px-1 py-1 text-xs text-primary">
        {['Astrology', 'Tarot', 'Moon Magic', 'Shadow Work'].map(topic => <Link className="inline-flex min-h-8 items-center" key={topic} to={topicPath(topic)}>{topic}</Link>)}
        {(posts.length > 0 || loading || error) && <Link className="inline-flex min-h-8 items-center underline" to="/explore">All topics</Link>}
      </nav>}
      {!loading && !error && pages > 1 && (
        <nav aria-label="Feed pages" className="flex items-center gap-3">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {pages}</span>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </nav>
      )}
      {floatingSpark && !keyboard && (
        <div
          data-scrolling={scrolling || undefined}
          className="home-floating-spark fixed bottom-[calc(var(--home-mobile-nav-height)+0.75rem)] right-4 z-[45] md:hidden"
        >
          <SparkItLink iconOnly linkRef={floatingSparkLink} inactive={scrolling} />
        </div>
      )}
    </main>
  );
}
