import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import SparkCard from '@/components/SparkCard';
import { useSession } from '@/lib/auth/auth-client';
import { findTopic, topicSlug } from '@/lib/spark-topics';
import type { CommunityPost } from '@/hooks/useCommunity';

type Member = { username: string; name: string | null; image: string | null };
export default function ExploreTopic() {
  const { topic: slug } = useParams();
  const topic = findTopic(slug);
  if (!topic) return <main className="p-5"><Link to="/explore">Back to Explore</Link><h1>Topic unavailable</h1></main>;
  return <main className="mx-auto max-w-xl space-y-3 px-4 py-4 pb-24">
    <Helmet><title>{topic} · Explore Spellful</title></Helmet>
    <Link className="text-sm text-muted-foreground" to="/explore">← Explore</Link>
    <h1 className="font-heading text-3xl">{topic}</h1>
    <TopicActivity key={topic} topic={topic} />
  </main>;
}

export function TopicActivity({ topic }: { topic: string }) {
  const { user } = useSession();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [more, setMore] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const json = async (path: string) => {
      const response = await fetch(path, { signal: abort.signal });
      if (!response.ok) throw Error();
      return response.json();
    };
    setStatus('loading');
    Promise.all([json('/api/community/posts?topic=' + topicSlug(topic) + '&page=' + page), json('/api/community/topics/' + topicSlug(topic) + '/members')])
      .then(([feed, profiles]) => {
        if (abort.signal.aborted) return;
        setPosts(feed.posts);
        setMembers(profiles.members);
        setMore(feed.pages > page);
        setStatus('ready');
      }).catch(() => { if (!abort.signal.aborted) setStatus('error'); });
    return () => abort.abort();
  }, [topic, page, user?.id]);
  return <>
    {status === 'loading' && <p role="status">Loading topic…</p>}
    {status === 'error' && <p role="alert">Couldn’t load this topic.</p>}
    {status === 'ready' && <>
      <section aria-label="Members with this interest">
        <h2 className="mb-1 font-semibold">Members</h2>
        <div className="flex gap-2 overflow-x-auto">
          {members.map(member => <Link key={member.username} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border px-2 text-sm" to={'/u/' + encodeURIComponent(member.username)}>
            {member.image && <img src={member.image} alt="" className="size-6 rounded-full object-cover" />}
            {member.name ?? '@' + member.username}
          </Link>)}
          {!members.length && <p className="text-sm text-muted-foreground">No discoverable members yet.</p>}
        </div>
      </section>
      <section className="space-y-2" aria-label="Topic Sparks">
        <h2 className="font-semibold">Sparks</h2>
        {posts.map(post => <SparkCard key={post.id} post={post} canInteract={!!user} />)}
        {!posts.length && <p className="text-sm text-muted-foreground">No Sparks yet.</p>}
      </section>
      <div className="flex gap-4">
        {page > 1 && <button onClick={() => setPage(value => value - 1)}>Previous</button>}
        {more && <button onClick={() => setPage(value => value + 1)}>Next</button>}
      </div>
    </>}
  </>;
}
