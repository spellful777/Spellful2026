import { SparkAttachments, useSparkAttachments } from '@/components/SparkAttachments';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Helmet } from '@dr.pogodin/react-helmet';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { X } from 'lucide-react';
import { SPARK_COMPOSE } from '@/lib/community-navigation';
import { SPARK_LIMIT, countSparkCharacters } from '@/lib/sparks';
import { useSession } from '@/lib/auth/auth-client';

export default function SparkComposer() {
  const { session, isPending } = useSession();
  const navigate = useNavigate();
  const [text, setText] = useState('');
  const [params] = useSearchParams();
  const quote = Number(params.get('quote'));
  const quotedPostId = Number.isSafeInteger(quote) && quote > 0 ? quote : undefined;
  const attachments = useSparkAttachments(Boolean(session && !quotedPostId));
  const canPublish = !attachments.busy && !attachments.replacement &&
    (!!text.trim() || attachments.uploads.length > 0 || !!quotedPostId) &&
    attachments.uploads.every(upload => upload.state === 'ready');
  const [audience, setAudience] = useState<'public' | 'coven'>('public');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submitLock = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const count = countSparkCharacters(text);
  const overLimit = count > SPARK_LIMIT;
  const author = session?.user;
  const username = (author as { username?: string } | undefined)?.username;

  useEffect(() => {
    const viewport = window.visualViewport;
    const root = form.current;
    if (!viewport || !root) return;
    const sync = () => root.style.setProperty('--spark-keyboard-offset', Math.round(viewport.offsetTop) + 'px');
    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
    };
  }, []);

  useEffect(() => {
    const textarea = field.current;
    if (!textarea || CSS.supports('field-sizing', 'content')) return;
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [text]);

  if (!isPending && !session) return <Navigate to={`/login?redirect=${encodeURIComponent(quotedPostId ? SPARK_COMPOSE + '&quote=' + quotedPostId : SPARK_COMPOSE)}`} replace />;

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (!session || submitLock.current || !canPublish || overLimit) return;
    submitLock.current = true;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'spark', body: text, audience, quotedPostId, mediaIds: attachments.uploads.map(upload => upload.id) }),
      });
      const result = await response.json() as { id?: number; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? 'Couldn’t publish your Spark.');
      navigate(`/community/post/${result.id}`, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Couldn’t publish your Spark.');
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  return (
    <main className="spark-draft">
      <Helmet><title>Spark it — Spellful</title></Helmet>
      <form ref={form} onSubmit={publish} className="spark-draft-form">
        <header className="spark-draft-header">
          <button type="button" className="spark-draft-close" aria-label="Close composer" disabled={submitting}
            onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/', { replace: true })}>
            <X aria-hidden="true" className="size-6" />
          </button>
          <h1>Spark it</h1>
          <button type="submit" disabled={!session || submitting || !canPublish || overLimit}
            aria-busy={submitting} className="spark-draft-post coven-press">
            {submitting ? 'Posting…' : 'Post'}
          </button>
        </header>
        <div className="spark-draft-card">
          {author && <div className="spark-draft-author">
            {author.image ? <img src={author.image} alt="" />
              : <span className="spark-draft-avatar" aria-hidden="true">{author.name?.charAt(0)?.toUpperCase() || '✦'}</span>}
            <strong>{author.name}</strong>
            {username && <span>@{username}</span>}
          </div>}
          <label htmlFor="spark-text" className="sr-only">Your Spark</label>
          <textarea ref={field} id="spark-text" value={text} readOnly={submitting}
            onChange={event => setText(event.target.value)} rows={1} placeholder="Write a Spark…"
            aria-describedby="spark-count" aria-invalid={overLimit} />
          {quotedPostId ? <p className="spark-draft-quote">
            This Spark includes the <Link to={'/community/post/' + quotedPostId}>original Spark</Link> and its media. Leave the text blank to reshare.
          </p> : <SparkAttachments attachments={attachments} disabled={submitting} />}
          <div className="spark-draft-meta">
            <label>
              <span className="sr-only">Audience</span>
              <select value={audience} disabled={submitting} onChange={event => setAudience(event.target.value === 'coven' ? 'coven' : 'public')}>
                <option value="public">Public</option>
                <option value="coven">Coven</option>
              </select>
            </label>
            <span id="spark-count" className={overLimit ? 'text-destructive' : undefined}>{count}/{SPARK_LIMIT} characters</span>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        {!submitting && <Link to="/community/new" state={{ discussionBody: text }} className="spark-draft-discussion">Start a discussion</Link>}
      </form>
    </main>
  );
}
