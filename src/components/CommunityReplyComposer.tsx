import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { Send, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CommentGifPicker } from '@/components/CommentGifPicker';
import { CommentLinkPreview } from '@/components/CommentLinkPreview';
import { commentUrl } from '@/lib/comment-links';
import { SPARK_COMMENT_LIMIT, COMMENT_GIF_SETTING } from '@/lib/spark-comments';
import { countSparkCharacters } from '@/lib/sparks';
import type { CommunityReply } from '@/hooks/useCommunityPost';
import { community_post } from 'virtual:content';

export type ReplyTarget = Pick<CommunityReply, 'id' | 'authorName' | 'authorUsername'>;
export const handleName = (author: { authorUsername: string | null; authorName: string | null }) =>
  author.authorUsername ? `@${author.authorUsername}` : author.authorName ?? 'Unknown member';

export function CommentHandle({ name }: { name: string }) {
  return name.startsWith('@') ? <Link className="underline" to={'/u/' + encodeURIComponent(name.slice(1))}>{name}</Link> : <>{name}</>;
}

export function ReplyComposer({
  postId,
  replyTo,
  onClear,
  onSubmitted,
  isLocked,
  canFollowUp,
  sparkAuthor,
  fieldRef,
}: {
  postId: number;
  replyTo: ReplyTarget | null;
  sparkAuthor?: string;
  fieldRef: React.RefObject<HTMLTextAreaElement | null>;
  onClear: () => void;
  onSubmitted: (replyId?: number) => void;
  isLocked: boolean;
  canFollowUp: boolean;
}) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState('');
  const [gifOpen, setGifOpen] = useState(false);
  const [removedPreview, setRemovedPreview] = useState<string | null>(null);
  const activeLink = commentUrl(body)?.href || null;
  const [gifUrl, setGifUrl] = useState<string | null>(null);
  const [gifsEnabled, setGifsEnabled] = useState(false);
  const count = countSparkCharacters(body);
  const tooLong = !!sparkAuthor && count > SPARK_COMMENT_LIMIT;
  useEffect(() => {
    if (!sparkAuthor) return;
    const abort = new AbortController();
    fetch('/api/account/privacy-settings', { signal: abort.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!abort.signal.aborted) setGifsEnabled(data?.settings?.commentGifsEnabled ??
          (localStorage.getItem(COMMENT_GIF_SETTING) !== 'false'));
      }).catch(() => {});
    return () => abort.abort();
  }, [sparkAuthor]);

  const submit = async () => {
    const trimmed = body.trim();
    if ((!trimmed && !gifUrl) || submitting || tooLong) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/community/posts/${postId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: trimmed, suppressLinkPreview: !!activeLink && activeLink === removedPreview, gifUrl: gifUrl ?? undefined, parentId: replyTo?.id ?? null, followUp: canFollowUp && !replyTo && followUp }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Could not post your reply.');
      }
      setBody('');
      setRemovedPreview(null);
      setGifUrl(null);
      setGifOpen(false);
      setFollowUp(false);
      onClear();
      const created = await res.json().catch(() => null);
      onSubmitted(typeof created?.id === 'number' ? created.id : undefined);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not post your reply.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLocked) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
        <Lock className="w-4 h-4" /> {community_post.lockedText}
      </div>
    );
  }

  return (
    <div className={sparkAuthor ? 'spark-comment-composer' : 'rounded-xl border border-border bg-card p-4'}>
      {(replyTo || sparkAuthor) && (
        <div className="flex items-center justify-between mb-2 text-xs text-accent">
          <span>Replying to <CommentHandle name={replyTo ? handleName(replyTo) : sparkAuthor!} />{sparkAuthor && replyTo && <> · Post by <CommentHandle name={sparkAuthor} /></>}</span>
          {replyTo && <button onClick={onClear} aria-label="Clear reply target" className="text-muted-foreground hover:text-foreground transition-colors">✕</button>}
        </div>
      )}
      {canFollowUp && !replyTo && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={followUp} onChange={event => setFollowUp(event.target.checked)} />
          Post an author follow-up
        </label>
      )}
      {error && <p role="alert" className="mb-2 text-sm text-destructive">{error}</p>}
      {gifOpen && <CommentGifPicker onPick={url => { setGifUrl(url); setGifOpen(false); }} />}
      {gifUrl && <div className="mb-2"><img className="spark-comment-gif" src={gifUrl} alt="Selected GIF" referrerPolicy="no-referrer" /><button onClick={() => setGifUrl(null)} className="min-h-11 text-xs">Remove GIF</button></div>}
      {sparkAuthor && activeLink && activeLink !== removedPreview && <CommentLinkPreview text={body} onRemove={() => setRemovedPreview(activeLink)} />}
      <div className={sparkAuthor ? 'spark-comment-input' : undefined}>
      <textarea
        ref={fieldRef}
        aria-label="Write a reply"
        aria-describedby={sparkAuthor && count >= 240 ? 'spark-comment-count' : undefined}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={sparkAuthor ? "Write a reply…" : community_post.replyPlaceholder}
        rows={sparkAuthor ? 1 : 4}
        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className={sparkAuthor ? 'flex items-center gap-2' : 'flex justify-end mt-2'}>
        {sparkAuthor && gifsEnabled && <Button size="sm" variant="outline" aria-label="Choose a GIF" aria-expanded={gifOpen} onClick={() => setGifOpen(open => !open)}><span>GIF</span></Button>}
        <Button
          size="sm"
          disabled={(!body.trim() && !gifUrl) || submitting || tooLong}
          onClick={submit}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {!sparkAuthor && <Send className="w-3.5 h-3.5" />}
          {submitting ? community_post.postingLabel : canFollowUp && !replyTo && followUp ? 'Post follow-up' : sparkAuthor ? 'Post' : community_post.postReplyLabel}
        </Button>
      </div>
      </div>
      {sparkAuthor && count >= 240 && <p id="spark-comment-count" className={`text-right text-xs ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>{count}/{SPARK_COMMENT_LIMIT}</p>}
    </div>
  );
}
