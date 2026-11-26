import { useState, type FormEvent } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, Navigate, useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import SparkIcon from '@/components/SparkIcon';
import { sparkActionClass } from '@/components/SparkItLink';
import { SPARK_COMPOSE } from '@/lib/community-navigation';
import { SPARK_LIMIT, countSparkCharacters } from '@/lib/sparks';
import { useSession } from '@/lib/auth/auth-client';

export default function SparkComposer() {
  const { session, isPending } = useSession();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [audience, setAudience] = useState<'public' | 'coven'>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const count = countSparkCharacters(text);
  const overLimit = count > SPARK_LIMIT;

  if (!isPending && !session) return <Navigate to={`/login?redirect=${encodeURIComponent(SPARK_COMPOSE)}`} replace />;

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!session || submitting || !text.trim() || overLimit) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'spark', body: text, audience }),
      });
      const result = await response.json() as { id?: number; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? 'Couldn’t publish your Spark.');
      navigate(`/community/post/${result.id}`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Couldn’t publish your Spark.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6">
      <Helmet><title>Spark it — Spellful</title></Helmet>
      <h1 className="font-heading text-3xl">Spark it</h1>
      <form onSubmit={publish} className="mt-4 space-y-3 rounded-xl border border-border bg-card p-4">
        <label htmlFor="spark-text" className="block text-sm font-semibold">Your Spark</label>
        <textarea
          id="spark-text"
          value={text}
          onChange={event => setText(event.target.value)}
          rows={4}
          aria-describedby="spark-count"
          aria-invalid={overLimit}
          className="w-full rounded-lg border border-border bg-background p-3 text-base focus-visible:outline focus-visible:outline-primary"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2">
            Audience
            <select value={audience} onChange={event => setAudience(event.target.value === 'coven' ? 'coven' : 'public')} className="min-h-11 rounded-lg border border-border bg-background px-2">
              <option value="public">Public</option>
              <option value="coven">Coven</option>
            </select>
          </label>
          <span id="spark-count" className={overLimit ? 'text-destructive' : 'text-muted-foreground'}>{count}/{SPARK_LIMIT} characters</span>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="submit" variant="outline" disabled={!session || submitting || !text.trim() || overLimit} className={sparkActionClass}>
            <SparkIcon className="size-5" monochrome />
            {submitting ? 'Publishing…' : 'Spark it'}
          </Button>
          <Link to="/community/new" state={{ discussionBody: text }} className="inline-flex min-h-11 items-center text-sm text-primary hover:underline">Start a discussion</Link>
        </div>
      </form>
    </main>
  );
}
