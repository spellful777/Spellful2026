import { SPARK_TOPICS } from '@/lib/spark-topics';
import { loadSparkReadingDraft, clearSparkReadingDraft } from '@/lib/spark-reading-draft';
import { SparkReadingAttachment } from '@/components/SparkReadingAttachment';
import { usePostDetail } from '@/hooks/useCommunityPost';
import { OriginalSparkCard } from '@/components/SparkMediaGallery';
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
  const readingId = params.get('reading');
  const [sourceReading, setSourceReading] = useState(() => loadSparkReadingDraft(readingId));
  useEffect(() => { setSourceReading(loadSparkReadingDraft(readingId)); }, [readingId]);
  const [includeMeanings, setIncludeMeanings] = useState(false);
  const reading = sourceReading?.type === 'tarot' ? { ...sourceReading, includeInterpretations: includeMeanings } : sourceReading;
  const [topicChoice, setTopic] = useState<string | null>(null);
  const topic = topicChoice ?? (reading?.type === 'natal' ? 'Astrology' : reading?.type === 'tarot' ? 'Tarot' : '');
  const quote = Number(params.get('quote'));
  const quotedPostId = Number.isSafeInteger(quote) && quote > 0 ? quote : undefined;
  const { post: original, loading: originalLoading } = usePostDetail(quotedPostId ?? null);
  const attachments = useSparkAttachments(Boolean(session && !quotedPostId && !readingId));
  const canPublish = !attachments.busy && !attachments.replacement &&
    (!!text.trim() || attachments.uploads.length > 0 || !!reading) &&
    (!readingId || !!reading) && (!quotedPostId || original?.audience === 'public') && attachments.uploads.every(upload => upload.state === 'ready');
  const [audience, setAudience] = useState<'public' | 'coven'>(readingId ? 'coven' : 'public');
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

  if (!isPending && !session && (!readingId || typeof window !== 'undefined')) {
    const redirect = SPARK_COMPOSE + (quotedPostId ? '&quote=' + quotedPostId : '') + (readingId ? '&reading=' + readingId : '');
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

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
        body: JSON.stringify({ type: 'spark', body: text, audience, quotedPostId, sparkTopic: topic || undefined, sparkReading: reading ?? undefined, mediaIds: attachments.uploads.map(upload => upload.id) }),
      });
      const result = await response.json() as { id?: number; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? 'Couldn’t publish your Spark.');
      clearSparkReadingDraft(readingId);
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
            onClick={() => { clearSparkReadingDraft(readingId); if (window.history.state?.idx > 0) navigate(-1); else navigate('/', { replace: true }); }}>
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
            onChange={event => setText(event.target.value)} rows={1} placeholder={reading ? "Add a caption (optional)…" : "Write a Spark…"}
            aria-describedby="spark-count" aria-invalid={overLimit} />
          {readingId ? reading ? <>
            <p className="text-xs text-muted-foreground">Feed preview · {audience === 'public' ? 'Public' : 'Coven only'}</p>
            {reading.type === 'tarot' && <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={includeMeanings} onChange={event => setIncludeMeanings(event.target.checked)} />
              Include standard card meanings
            </label>}
            <SparkReadingAttachment reading={reading} />
            <p className="text-xs text-muted-foreground">{reading.type === 'natal'
              ? 'Shares the wheel without your birth details.'
              : 'Shares the spread and any selected card meanings. Your question and private notes stay out.'}</p>
          </> : <p role="status" className="text-sm">This reading draft is unavailable. Open Spark from the completed reading again.</p>
          : quotedPostId ? originalLoading ? <p>Loading original Spark…</p> : <OriginalSparkCard spark={original?.audience === 'public' ? {
            id: original.id, title: original.title, authorName: original.authorName, imageUrl: original.imageUrl,
            sparkMedia: original.sparkMedia ?? null, sparkReading: original.sparkReading,
          } : null} /> : <SparkAttachments attachments={attachments} disabled={submitting} />}
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
          <label className="flex min-h-11 items-center justify-between gap-2 text-sm">
            <span>Topic</span>
            <select className="min-w-0 rounded border border-border bg-background px-2 py-2" value={topic}
              onChange={event => setTopic(event.target.value)} disabled={submitting}>
              <option value="">No topic</option>
              {SPARK_TOPICS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
        {!submitting && <Link to="/community/new" state={{ discussionBody: text }} className="spark-draft-discussion">Start a discussion</Link>}
      </form>
    </main>
  );
}
