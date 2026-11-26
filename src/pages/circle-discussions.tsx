import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Button } from '@/components/ui/button';
import { useSession } from '@/lib/auth/auth-client';
import { useCommunityPosts } from '@/hooks/useCommunity';
import { useSpellfulCircles } from '@/hooks/useSpellfulCircles';
import { PostCard } from './community/index';

interface CircleSettings {
  rules: string;
  welcome: { id: number; title: string } | null;
  canModerate: boolean;
}

function CirclePosts({ circleId }: { circleId: number }) {
  const [filter, setFilter] = useState<'chronological' | 'active'>('chronological');
  const [page, setPage] = useState(1);
  const { posts, loading, error, reload, pages } = useCommunityPosts(filter, undefined, page, undefined, circleId);
  const [settings, setSettings] = useState<CircleSettings | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const [editingRules, setEditingRules] = useState(false);
  const [rulesDraft, setRulesDraft] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const settingsUrl = `/api/circles/${circleId}/settings`;

  useEffect(() => {
    const controller = new AbortController();
    fetch(settingsUrl, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error();
        const result = await response.json() as CircleSettings;
        if (!controller.signal.aborted) {
          setSettings(result);
          setRulesDraft(result.rules);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setSettingsError('Circle rules and welcome couldn’t load.');
      });
    return () => controller.abort();
  }, [settingsUrl]);

  async function updateSettings(update: { rules?: string; welcomePostId?: number | null }, title?: string) {
    setSavingSettings(true);
    setSettingsError('');
    try {
      const response = await fetch(settingsUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Could not save Circle settings.');
      }
      setSettings(previous => previous && {
        ...previous,
        rules: update.rules?.trim() ?? previous.rules,
        welcome: update.welcomePostId === undefined ? previous.welcome
          : update.welcomePostId && title ? { id: update.welcomePostId, title } : null,
      });
      if (update.rules !== undefined) setEditingRules(false);
    } catch (failure) {
      setSettingsError(failure instanceof Error ? failure.message : 'Could not save Circle settings.');
    } finally {
      setSavingSettings(false);
    }
  }
  return (
    <>
      {settingsError && <p role="status" className="text-sm text-destructive">{settingsError}</p>}
      {settings && (
        <section aria-label="Circle rules and welcome" className="space-y-3 rounded-xl border border-border bg-card p-4">
          <h2 className="font-heading text-lg">Circle rules</h2>
          {editingRules ? (
            <form className="space-y-2" onSubmit={event => {
              event.preventDefault();
              void updateSettings({ rules: rulesDraft });
            }}>
              <label className="block text-sm" htmlFor="circle-rules">Rules shown to Circle members</label>
              <textarea id="circle-rules" className="min-h-28 w-full rounded-md border border-border bg-background p-2" maxLength={4000} value={rulesDraft} onChange={event => setRulesDraft(event.target.value)} />
              <div className="flex gap-2">
                <Button type="submit" disabled={savingSettings}>Save rules</Button>
                <Button type="button" variant="outline" disabled={savingSettings} onClick={() => setEditingRules(false)}>Cancel</Button>
              </div>
            </form>
          ) : (
            <>
              <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{settings.rules || 'This Circle hasn’t added rules yet.'}</p>
              {settings.canModerate && <Button size="sm" variant="outline" onClick={() => { setRulesDraft(settings.rules); setEditingRules(true); }}>Edit rules</Button>}
            </>
          )}
          {settings.welcome && (
            <div className="border-t border-border pt-3">
              <p className="text-sm font-semibold">Pinned welcome</p>
              <Link className="text-primary underline" to={`/community/post/${settings.welcome.id}`}>{settings.welcome.title}</Link>
              {settings.canModerate && (
                <Button className="ml-2" size="sm" variant="ghost" disabled={savingSettings} onClick={() => updateSettings({ welcomePostId: null })}>Unpin welcome</Button>
              )}
            </div>
          )}
        </section>
      )}
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
        <div className="space-y-3">{posts.map(post => (
          <div key={post.id} className="space-y-1">
            <PostCard post={post} />
            {settings?.canModerate && settings.welcome?.id !== post.id && (
              <Button size="sm" variant="ghost" disabled={savingSettings} onClick={() => updateSettings({ welcomePostId: post.id }, post.title)}>Pin as welcome</Button>
            )}
          </div>
        ))}</div>
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
