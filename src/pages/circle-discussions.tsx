import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/auth-client';
import { useCommunityPosts } from '@/hooks/useCommunity';
import { useSpellfulCircles } from '@/hooks/useSpellfulCircles';
import { PostCard } from './community/index';

function CirclePosts({ circleId }: { circleId: number }) {
  const [filter, setFilter] = useState<'chronological' | 'active'>('chronological');
  const [page, setPage] = useState(1);
  const { posts, loading, error, reload, pages } = useCommunityPosts(filter, undefined, page, undefined, circleId);
  return (
    <>
      <nav className="flex flex-wrap gap-2" aria-label="Circle discussion order">
        {(['chronological', 'active'] as const).map(order => (
          <Button key={order} variant={filter === order ? 'default' : 'outline'} aria-pressed={filter === order} onClick={() => {
            setFilter(order);
            setPage(1);
          }}>
            {order === 'active' ? 'Active' : 'New'}
          </Button>
        ))}
        <Button asChild variant="outline"><Link to={`/community/new?circle=${circleId}`}>Start discussion</Link></Button>
        <Button asChild variant="outline"><Link to={`/community/search?circle=${circleId}`}>Search this Circle</Link></Button>
      </nav>
      {loading ? <p role="status">Loading discussions…</p> : error ? (
        <div><p role="status">Couldn’t load discussions.</p><Button variant="outline" onClick={reload}>Try again</Button></div>
      ) : posts.length ? (
        <div className="space-y-3">{posts.map(post => <PostCard key={post.id} post={post} />)}</div>
      ) : <p>No discussions yet.</p>}
      {!loading && !error && pages > 1 && (
        <nav className="flex items-center gap-3" aria-label="Circle discussion pages">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {pages}</span>
          <Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</Button>
        </nav>
      )}
    </>
  );
}

export default function CircleDiscussionsPage() {
  const { id } = useParams<{ id: string }>();
  const { session, isPending } = useSession();
  const { circles, loading } = useSpellfulCircles();
  const circle = circles.find(item => item.id === Number(id));

  if (isPending) return <p role="status" className="p-6">Loading Circle…</p>;
  if (!session) return <Navigate replace to={`/login?redirect=${encodeURIComponent(`/circles/${id}`)}`} />;

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 pb-24 pt-8">
      <Helmet><title>{circle?.name ?? 'Circle discussions'} | Spellful</title><meta name="robots" content="noindex" /></Helmet>
      <Link to="/circles" className="text-primary underline">Browse Circles</Link>
      {loading ? <p role="status">Loading Circle…</p> : circle ? (
        <>
          <h1 className="font-heading text-3xl">{circle.name}</h1>
          <p className="text-muted-foreground">{circle.description}</p>
          {circle.my_status === 'active'
            ? <CirclePosts key={circle.id} circleId={circle.id} />
            : <p>Join this Circle to read or post discussions.</p>}
        </>
      ) : <p>Circle unavailable.</p>}
    </main>
  );
}
