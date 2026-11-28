import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigationType } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Users } from 'lucide-react';
import HomeSocialMenu from './HomeSocialMenu';
import SparkCard from './SparkCard';
import SparkItLink from './SparkItLink';
import { ForumDirectory } from './ForumDirectory';
import type { CommunityPost } from '@/hooks/useCommunity';
import { COMMUNITY_CONNECTIONS } from '@/lib/community-navigation';

const positions = new Map<string, { pages: number; y: number }>();
type Batch = { posts: CommunityPost[]; total: number; newestId: number };

export default function CommunitySocial({ viewer, username, forums }: { viewer?: string; username?: string | null; forums: boolean }) {
  const location = useLocation();
  const key = (viewer ?? 'visitor') + ':' + location.key;
  const back = useNavigationType() === 'POP';
  const [restore] = useState(() => back ? positions.get(key) : undefined);
  const following = !!viewer && new URLSearchParams(location.search).get('filter') === 'following';
  const filter = following ? 'following' : 'feed';
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const [newest, setNewest] = useState(0);
  const marker = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLAnchorElement>(null);
  const [hidden, setHidden] = useState(false);
  const [moving, setMoving] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const pages = useRef(0);
  const cursor = useRef<CommunityPost | undefined>(undefined);
  const request = useRef<AbortController | null>(null);
  const restoreY = useRef(restore?.y);
  const load = useCallback(async (count = 1) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setError(false);
    setBusy(true);
    try {
      for (let i = 0; i < count; i++) {
        const params = new URLSearchParams({ filter, limit: '20' });
        if (cursor.current) {
          params.set('beforeId', String(cursor.current.id));
          params.set('beforeTime', cursor.current.createdAt);
        }
        const response = await fetch('/api/community/posts?' + params, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw Error();
        const batch: Batch = await response.json();
        if (controller.signal.aborted) return;
        if (!pages.current) setNewest(batch.newestId);
        pages.current++;
        cursor.current = batch.posts.at(-1);
        setPosts(old => {
          const ids = new Set(old.map(p => p.id));
          return [...old, ...batch.posts.filter(p => !ids.has(p.id))];
        });
        const hasMore = batch.posts.length > 0 && batch.total > batch.posts.length;
        setMore(hasMore);
        if (!hasMore) break;
      }
    } catch { if (!controller.signal.aborted) setError(true); }
    finally { if (request.current === controller) { request.current = null; setBusy(false); } }
  }, [filter]);
  useEffect(() => {
    if (forums) return;
    pages.current = 0;
    cursor.current = undefined;
    setPosts([]); setMore(true); setFresh(false);
    void load(epoch === 0 ? restore?.pages || 1 : 1);
    return () => { request.current?.abort(); request.current = null; };
  }, [load, forums, restore, epoch]);

  useLayoutEffect(() => {
    if (!busy && restoreY.current !== undefined) {
      window.scrollTo(0, restoreY.current); restoreY.current = undefined;
    }
  }, [busy]);

  useEffect(() => {
    if (forums || error || busy || !more || !marker.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) void load();
    }, { rootMargin: '280px' });
    observer.observe(marker.current);
    return () => observer.disconnect();
  }, [forums, error, busy, more, load]);

  useEffect(() => {
    if (forums || !pages.current) return;
    const controller = new AbortController();
    const poll = setInterval(async () => {
      if (document.hidden) return;
      try {
        const r = await fetch('/api/community/posts?' + new URLSearchParams({filter, afterId: String(newest)}), { signal: controller.signal, cache: 'no-store' });
        if (r.ok && (await r.json()).hasNewPosts && !controller.signal.aborted) setFresh(true);
      } catch { /* Keep already loaded posts readable. */ }
    }, 45000);
    return () => { controller.abort(); clearInterval(poll); };
  }, [filter, newest, forums, busy]);

  useEffect(() => {
    const button = header.current;
    if (!button) return;
    const observer = new IntersectionObserver(() => setHidden(button.getBoundingClientRect().bottom <= 0));
    observer.observe(button);
    let timer: ReturnType<typeof setTimeout>;
    const remember = () => {
      if (!pages.current || restoreY.current !== undefined) return;
      if (positions.size > 48) positions.delete(positions.keys().next().value!);
      positions.set(key, { y: window.scrollY, pages: pages.current });
    };
    const scroll = () => { remember(); setMoving(true); clearTimeout(timer); timer = setTimeout(() => setMoving(false), 200); };
    const viewport = window.visualViewport;
    const resize = () => setKeyboard(!!viewport && window.innerHeight - viewport.height > 100);
    window.addEventListener('scroll', scroll, { passive: true });
    document.addEventListener('click', remember, true);
    viewport?.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('scroll', scroll); document.removeEventListener('click', remember, true);
      viewport?.removeEventListener('resize', resize); clearTimeout(timer); };
  }, [key]);

  return <main className="home-feed community-social mx-auto min-h-screen max-w-2xl space-y-2 px-3 pt-2">
    <Helmet><title>Community | Spellful</title></Helmet>
    <HomeSocialMenu community visitor={!viewer} username={username} sparkRef={header} floatingSpark={hidden} />
    <nav aria-label="Community" className="home-feed-tabs sticky top-0 z-30 grid grid-cols-2 md:top-16">
      <Link className="home-feed-link" aria-current={!forums ? 'page' : undefined} to="/community">Feed</Link>
      <Link className="home-feed-link" aria-current={forums ? 'page' : undefined} to="/community?view=forums">Forums</Link>
    </nav>
    {forums ? <ForumDirectory viewer={viewer} /> : <>
      <div className="feed-tools">
        {viewer && <div aria-label="Feed filter"><Link aria-current={!following ? 'true' : undefined} to="/community">All</Link>
          <Link aria-current={following ? 'true' : undefined} to="/community?filter=following">Following</Link></div>}
        <Link className="coven-shortcut" to={COMMUNITY_CONNECTIONS}><Users size={15} /> My Coven</Link>
      </div>
      {fresh && <button className="new-posts" onClick={() => { window.scrollTo(0,0); setEpoch(e => e + 1); }}>New posts</button>}
      {posts.map(post => <SparkCard key={post.id} compact post={post} canInteract={!!viewer} />)}
      <div ref={marker} aria-live="polite" className="feed-status">{error ? <button onClick={() => void load()}>Couldn’t load posts. Retry</button>
        : busy ? 'Loading posts…' : !more ? 'You’re all caught up.' : <button onClick={() => void load()}>Load more posts</button>}</div>
    </>}
    {hidden && !keyboard && <div className="home-floating-spark community-compose fixed right-4 z-[45] md:hidden" data-scrolling={moving || undefined}>
      <SparkItLink iconOnly inactive={moving} />
    </div>}
  </main>;
}
