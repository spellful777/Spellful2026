import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { SparkByline, type SparkAuthor } from '@/components/SparkByline';
import SparkCard from '@/components/SparkCard';
import { CommunityPostBody } from '@/components/CommunityPostBody';
import { sparkReplyPath } from '@/lib/spark-comments';
import { sparkMediaPath } from '@/lib/spark-media';
import type { CommunityPost } from '@/hooks/useCommunity';

export type ProfileTab = 'sparks' | 'replies' | 'media' | 'about';
type Post = CommunityPost & { featured?: boolean };
type Reply = { id: number; postId: number; body: string; originalAuthor: string | null; originalName: string | null; originalText: string; createdAt: string | null; gifUrl?: string };
type Page = { posts?: Post[]; replies?: Reply[]; next?: number | null };

export function ProfileActivity({ endpoint, tab, preview, canInteract, author }: {
  endpoint: string; tab: Exclude<ProfileTab, 'about'>; preview?: string | null; canInteract: boolean; author: SparkAuthor;
}) {
  const [page, setPage] = useState<Page | null>(null);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ activity: tab });
    if (preview) params.set('preview', preview);
    if (cursor) params.set('before', String(cursor));
    setLoading(true);
    setError(false);
    fetch(`${endpoint}?${params}`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw Error(); return response.json() as Promise<Page>; })
      .then(next => {
        if (!controller.signal.aborted) setPage(current => cursor ? {
          ...next, posts: [...(current?.posts ?? []), ...(next.posts ?? []).filter(post => !current?.posts?.some(existing => existing.id === post.id))],
          replies: [...(current?.replies ?? []), ...(next.replies ?? [])],
        } : next);
      }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, tab, preview, cursor, retry]);

  const media = tab === 'media' ? (page?.posts ?? []).flatMap(post => {
    const source = post.originalSpark ?? post;
    const assets = source.sparkMedia?.map(file => ({ key: file.id, video: file.kind === 'video',
      src: sparkMediaPath(file.id, file.kind === 'video'), postId: source.id })) ?? [];
    if (!assets.length && source.imageUrl && /^https:\/\//i.test(source.imageUrl)) {
      assets.push({ key: 'legacy', video: false, src: source.imageUrl, postId: source.id });
    }
    return assets.map(item => ({ ...item, key: post.id + '-' + item.key }));
  }) : [];
  const empty = tab === 'media' ? !media.length : tab === 'replies' ? !page?.replies?.length : !page?.posts?.length;

  return <div className="profile-activity" aria-busy={loading}>
    {tab === 'sparks' && page?.posts?.map(post => <div key={post.id}>
      {post.featured && <p className="profile-feature-label">Featured Post</p>}
      <SparkCard post={post} canInteract={canInteract} />
    </div>)}
    {tab === 'replies' && page?.replies?.map(reply => <article key={reply.id} className="profile-reply">
      <SparkByline author={author} createdAt={reply.createdAt} />
      <div className="profile-reply-thread">
        <Link className="text-sm text-muted-foreground" to={sparkReplyPath(reply.postId, reply.id)}>
          Replying to a Post by {reply.originalAuthor ? '@' + reply.originalAuthor : reply.originalName ?? 'a member'}
        </Link>
        <CommunityPostBody html={reply.body} />
        {reply.gifUrl && <img src={reply.gifUrl} alt="GIF attachment" className="mt-1 max-h-24 rounded" loading="lazy" referrerPolicy="no-referrer" />}
        <Link to={`/community/post/${reply.postId}`} className="profile-reply-original">
          <strong>{reply.originalName || reply.originalAuthor || 'Member'}</strong>
          {reply.originalAuthor && <small> @{reply.originalAuthor}</small>}
          <blockquote>{reply.originalText}</blockquote>
        </Link>
      </div>
    </article>)}
    {tab === 'media' && <div className="profile-media-grid">
      {media.map(item => <Link key={item.key} to={`/community/post/${item.postId}`} aria-label={`Open ${item.video ? 'video' : 'photo'} Post`}>
        <img src={item.src} alt="" loading="lazy" referrerPolicy="no-referrer" />
        {item.video && <Play className="profile-media-play" aria-hidden="true" />}
      </Link>)}
    </div>}
    {empty && !loading && !error && <p className="profile-empty">No {tab === 'media' ? 'media' : tab === 'sparks' ? 'posts' : tab} to show.</p>}
    {loading && <p className="profile-empty" role="status">Loading…</p>}
    {error && <button className="profile-empty" type="button" onClick={() => setRetry(value => value + 1)}>Couldn’t load this tab. Try again.</button>}
    {page?.next && !loading && !error && <button className="profile-empty" onClick={() => setCursor(page.next!)}>Load more</button>}
  </div>;
}
