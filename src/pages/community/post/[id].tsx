import { hasNativeShare, publicShareUrl, shareContent } from '@/lib/share-studio';
import { uploadedMediaUrl } from '@/lib/native-api';
import type { SharedHoroscope } from '@/lib/spark-reading';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SparkReadingAttachment } from '@/components/SparkReadingAttachment';
import { topicPath } from '@/lib/spark-topics';
import { CommentGifPicker } from '@/components/CommentGifPicker';
import { SparkActions } from '@/components/SparkActions';
import { CommentLinkPreview } from '@/components/CommentLinkPreview';
import { commentUrl } from '@/lib/comment-links';
import { OriginalSparkCard, SparkMediaGallery } from '@/components/SparkMediaGallery';
import { parseFragment } from 'parse5';
import { SparkCommentActions } from '@/components/SparkCommentActions';
import { SPARK_COMMENT_LIMIT, COMMENT_GIF_SETTING } from '@/lib/spark-comments';
import { SPARK_LIMIT, countSparkCharacters } from '@/lib/sparks';
import SparkHeartButton from '@/components/SparkHeartButton';
import { useState, useRef, useEffect } from 'react';
import { Link, useParams, useNavigate, useLocation, useLoaderData } from 'react-router';
import { Helmet } from '@dr.pogodin/react-helmet';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft, ThumbsUp, Bookmark, Flag, MessageSquare,
  HelpCircle, Pin, Lock, CheckCircle2, MoreHorizontal,
  Eye, Tag, Share2, Sparkles, Send, MapPin, Pencil, Trash2, Scale,
} from 'lucide-react';
import { useSession } from '@/lib/auth/auth-client';
import { CommunityPostBody } from '@/components/CommunityPostBody';
import { BlockUserSheet } from '@/components/BlockUserSheet';
import { ReportModal } from '@/components/ReportModal';
import AppealModal from '@/components/AppealModal';
import { usePostDetail, useReplies, type CommunityReply } from '@/hooks/useCommunityPost';
import { community_post } from 'virtual:content';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, formatDistanceToNowStrict } from 'date-fns';

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, image, size = 8 }: { name: string | null; image: string | null; size?: number }) {
  const s = size === 7 ? 'size-7' : 'size-8';
  if (image) return <img src={uploadedMediaUrl(image)} alt={name ?? ''} className={`${s} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${s} rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0`}>
      {(name ?? '?')[0].toUpperCase()}
    </div>
  );
}

// ── Poll ──────────────────────────────────────────────────────────────────────

function PollBlock({
  poll,
  postId,
  onVoted,
}: {
  poll: NonNullable<ReturnType<typeof usePostDetail>['post']>['poll'];
  postId: number;
  onVoted: () => void;
}) {
  const [voting, setVoting] = useState(false);
  if (!poll) return null;

  const isClosed = poll.closeAt ? new Date(poll.closeAt) < new Date() : false;
  const hasVoted = poll.myVote !== null;
  const showResults = hasVoted || isClosed;

  const vote = async (choiceIndex: number) => {
    if (voting || hasVoted || isClosed) return;
    setVoting(true);
    await fetch(`/api/community/posts/${postId}/poll/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ choiceIndex }),
    });
    setVoting(false);
    onVoted();
  };

  return (
    <div className="rounded-xl border border-border bg-[hsl(var(--card-deep))] p-4 mt-4">
      <p className="text-sm font-semibold text-foreground mb-3">{poll.question}</p>
      <div className="space-y-2">
        {poll.choices.map((choice, i) => {
          // eslint-disable-next-line security/detect-object-injection
          const tally = poll.tallies[i] ?? 0;
          const pct = poll.totalVotes > 0 ? Math.round((tally / poll.totalVotes) * 100) : 0;
          const isMyVote = poll.myVote === i;
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={showResults || voting}
              className={`relative w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors overflow-hidden ${
                isMyVote
                  ? 'border-primary text-primary'
                  : showResults
                  ? 'border-border text-foreground/70 cursor-default'
                  : 'border-border hover:border-primary/50 text-foreground'
              }`}
            >
              {showResults && (
                <span
                  className="absolute inset-y-0 left-0 bg-primary/10 transition-all"
                  style={{ width: `${pct}%` }}
                />
              )}
              <span className="relative flex items-center justify-between gap-2">
                <span>{choice}</span>
                {showResults && (
                  <span className="text-xs text-muted-foreground shrink-0">{pct}% · {tally}</span>
                )}
                {isMyVote && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
        {isClosed ? ' · Closed' : poll.closeAt ? ` · Closes ${formatDistanceToNow(new Date(poll.closeAt), { addSuffix: true })}` : ''}
      </p>
    </div>
  );
}

// ── Reply card ────────────────────────────────────────────────────────────────

type ReplyTarget = Pick<CommunityReply, 'id' | 'authorName' | 'authorUsername'>;
const handleName = (author: { authorUsername: string | null; authorName: string | null }) =>
  author.authorUsername ? `@${author.authorUsername}` : author.authorName ?? 'Unknown member';

function CommentHandle({ name }: { name: string }) {
  return name.startsWith('@') ? <Link className="underline" to={'/u/' + encodeURIComponent(name.slice(1))}>{name}</Link> : <>{name}</>;
}

function ReplyCard({
  reply,
  isAccepted,
  isPostAuthor,
  postType,
  sparkContext,
  onUpdate,
  onAccept,
  onLike,
  onReplyTo,
  onDeleted,
  currentUserId,
  depth = 0,
  children,
}: {
  reply: CommunityReply;
  isAccepted: boolean;
  isPostAuthor: boolean;
  postType: 'discussion' | 'question' | 'spark';
  postId: number;
  sparkContext?: { original: string; parent: string; audience: string | null; locked: boolean; canInteract: boolean };
  onUpdate: (reply: CommunityReply) => void;
  onAccept: (replyId: number) => void;
  onLike: (replyId: number) => void;
  onReplyTo: (reply: ReplyTarget) => void;
  onDeleted: (replyId: number) => void;
  currentUserId: string | undefined;
  depth?: number;
  children?: React.ReactNode;
}) {
  const [showActions, setShowActions] = useState(false);
  const [blockSheetOpen, setBlockSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState(reply.body);
  const [editSaving, setEditSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isMyReply = currentUserId === reply.userId;

  const saveEdit = async () => {
    if ((!editBody.trim() && !reply.gifUrl) || editSaving || (sparkContext && countSparkCharacters(editBody) > SPARK_COMMENT_LIMIT)) return;
    setEditSaving(true);
    const response = await fetch(`/api/community/replies/${reply.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editBody.trim() }),
    });
    setEditSaving(false);
    if (!response.ok) return;
    const { body } = await response.json();
    setEditMode(false);
    onUpdate({ ...reply, body });
  };

  const deleteReply = async () => {
    setDeleting(true);
    const res = await fetch(`/api/community/replies/${reply.id}`, { method: 'DELETE' });
    setDeleting(false);
    if (res.ok) onDeleted(reply.id);
  };
  const ago = sparkContext ? formatDistanceToNowStrict(new Date(reply.createdAt), { addSuffix: true })
    : formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true });
  const indentClass = sparkContext ? "spark-comment-node" : depth > 0 ? 'ml-6 md:ml-10 border-l-2 border-border pl-4' : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' as const }}
      id={`reply-${reply.id}`}
      tabIndex={-1}
      className={`${indentClass} scroll-mt-24 focus:outline focus:outline-2 focus:outline-primary`}
    >
      <div className={sparkContext ? "spark-comment-row" : `rounded-xl border p-4 ${isAccepted ? 'border-[hsl(var(--success))] bg-[hsl(var(--success))]/5' : 'border-border bg-card'}`}>
        {/* Accepted badge */}
        {isAccepted && (
          <div className="flex items-center gap-1.5 text-[hsl(var(--success))] text-xs font-semibold mb-2">
            <CheckCircle2 className="w-3.5 h-3.5" /> {community_post.acceptedAnswerLabel}
          </div>
        )}

        {/* Author row */}
        <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
            <Avatar name={reply.authorName} image={reply.authorImage} size={7} />
            <div>
              <Link
                to={reply.authorUsername ? `/u/${reply.authorUsername}` : '#'}
                className="text-xs font-semibold text-foreground hover:text-primary transition-colors"
              >
                {reply.authorName ?? 'Unknown'}
              </Link>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs text-muted-foreground">{sparkContext && reply.authorUsername && `@${reply.authorUsername} · `}{ago}</p>
                {reply.authorLocation && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                    <MapPin className="w-2 h-2" />{reply.authorLocation}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions menu */}
          <div className="relative">
            <button
              onClick={() => setShowActions((v) => !v)}
              aria-label="Comment options"
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {showActions && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-7 z-10 w-36 rounded-lg border border-border bg-popover shadow-lg overflow-hidden"
                >
                  <button
                    onClick={() => { onReplyTo(reply); setShowActions(false); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                  >
                    Reply
                  </button>
                  {isMyReply && (
                    <button
                      onClick={() => { setEditMode(true); setEditBody(sparkContext ? parseFragment(reply.body).childNodes.map(node => "value" in node ? node.value : "").join("") || reply.body : reply.body); setShowActions(false); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                  )}
                  {isMyReply && (
                    <button
                      onClick={() => { setConfirmDelete(true); setShowActions(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-muted transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  )}
                  {!isMyReply && (
                    <button
                      onClick={() => { setShowActions(false); setReportOpen(true); }}
                      className="w-full text-left px-3 py-2 text-xs text-destructive hover:bg-muted transition-colors"
                    >
                      Report
                    </button>
                  )}
                  {currentUserId && reply.userId !== currentUserId && (
                    <button
                      onClick={() => { setShowActions(false); setBlockSheetOpen(true); }}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors"
                      style={{ color: 'hsl(var(--muted-foreground))' }}
                    >
                      Restrict member
                    </button>
                  )}
                  {isPostAuthor && postType === 'question' && !isAccepted && (
                    <button
                      onClick={() => { onAccept(reply.id); setShowActions(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-[hsl(var(--success))] hover:bg-muted transition-colors"
                    >
                      {community_post.acceptAnswerLabel}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Block sheet */}
        {sparkContext && <p className="spark-comment-context">Replying to <CommentHandle name={sparkContext.parent} /> · Spark by <CommentHandle name={sparkContext.original} /></p>}
        {reply.userId && reply.userId !== currentUserId && (
          <BlockUserSheet
            open={blockSheetOpen}
            onOpenChange={setBlockSheetOpen}
            displayName={reply.authorName ?? 'this member'}
            userId={reply.userId}
          />
        )}

        {/* Report modal */}
        <ReportModal
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          targetType="reply"
          targetId={reply.id}
        />

        {/* Confirm delete dialog */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-center justify-between gap-3"
            >
              <p className="text-xs text-destructive">Delete this reply?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={deleteReply}
                  disabled={deleting}
                  className="text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Body / edit mode */}
        {editMode ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              rows={4}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditMode(false)}
                className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving || (!editBody.trim() && !reply.gifUrl) || Boolean(sparkContext && countSparkCharacters(editBody) > SPARK_COMMENT_LIMIT)}
                className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {editSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <CommunityPostBody html={reply.body} autoLink={!!sparkContext} />
            {sparkContext && reply.gifUrl && <img className="spark-comment-gif" src={reply.gifUrl} alt="GIF attachment" loading="lazy" referrerPolicy="no-referrer" />}
            {sparkContext && !reply.suppressLinkPreview && <CommentLinkPreview text={parseFragment(reply.body).childNodes.map(node => "value" in node ? node.value : "").join("") || reply.body} />}
          </>
        )}

        {/* Footer */}
        {sparkContext ? <SparkCommentActions reply={reply} onReply={() => onReplyTo(reply)} locked={sparkContext.locked} canInteract={sparkContext.canInteract} audience={sparkContext.audience} onUpdate={onUpdate} /> : <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/50">
          <button
            onClick={() => onLike(reply.id)}
            className={`flex items-center gap-1 text-xs transition-colors ${reply.liked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ThumbsUp className="w-3.5 h-3.5" /> {reply.likeCount}
          </button>
          <button
            onClick={() => onReplyTo(reply)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Reply
          </button>
        </div>}
        {!sparkContext && !!reply.likedBy?.length && <p className="text-xs text-muted-foreground">
          Liked by {reply.likedBy.join(', ')}{reply.likeCount > reply.likedBy.length ? ` and ${reply.likeCount - reply.likedBy.length} others` : ''}
        </p>}
      </div>

      {/* Nested children */}
      {children && <div className={sparkContext ? `spark-comment-branch ${depth >= 2 ? "spark-comment-branch-compact" : ""}` : "mt-2 space-y-2"}>{children}</div>}
    </motion.div>
  );
}

// ── Reply composer ────────────────────────────────────────────────────────────

function ReplyComposer({
  postId,
  replyTo,
  onClear,
  onSubmitted,
  isLocked,
  canFollowUp,
  sparkAuthor,
}: {
  postId: number;
  replyTo: ReplyTarget | null;
  sparkAuthor?: string;
  onClear: () => void;
  onSubmitted: () => void;
  isLocked: boolean;
  canFollowUp: boolean;
}) {
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [followUp, setFollowUp] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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
  useEffect(() => { if (replyTo) textareaRef.current?.focus(); }, [replyTo]);

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
      onSubmitted();
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
          <span>Replying to <CommentHandle name={replyTo ? handleName(replyTo) : sparkAuthor!} />{sparkAuthor && <> · Spark by <CommentHandle name={sparkAuthor} /></>}</span>
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
        ref={textareaRef}
        aria-label="Write a reply"
        aria-describedby={sparkAuthor && count >= 240 ? 'spark-comment-count' : undefined}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={community_post.replyPlaceholder}
        rows={sparkAuthor ? 2 : 4}
        className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className={sparkAuthor ? 'flex items-center gap-2' : 'flex justify-end mt-2'}>
        {sparkAuthor && gifsEnabled && <Button size="sm" variant="outline" aria-label="Choose a GIF" aria-expanded={gifOpen} onClick={() => setGifOpen(open => !open)}>GIF</Button>}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PostThreadPage() {
  const loader = useLoaderData() as { readingPreview: { type: 'natal' | 'tarot' } | SharedHoroscope | null } | undefined;
  const { id } = useParams<{ id: string }>();
  const { session, isPending } = useSession();
  const navigate = useNavigate();
  const postId = id ? parseInt(id) : null;

  const { post, loading: postLoading, error, reload: reloadPost, setPost } = usePostDetail(postId, session?.user.id);
  const [sort, setSort] = useState<'chrono' | 'liked'>('chrono');
  const { replies, loading: repliesLoading, error: repliesError, reload: reloadReplies, setReplies } = useReplies(postId, sort, session?.user.id);
  const { hash, pathname } = useLocation();
  const [missingReply, setMissingReply] = useState(false);
  useEffect(() => {
    if (postLoading || repliesLoading || repliesError) return;
    if (!/^#reply-\d+$/.test(hash)) { setMissingReply(false); return; }
    const target = document.getElementById(hash.slice(1));
    setMissingReply(!target);
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'start' });
  }, [hash, postLoading, repliesLoading, repliesError]);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [showShareToast, setShowShareToast] = useState(false);

  const [muting, setMuting] = useState(false);
  const [muteStatus, setMuteStatus] = useState('');
  const [appealOpen, setAppealOpen] = useState(false);
  const [postReportOpen, setPostReportOpen] = useState(false);
  const [postEditMode, setPostEditMode] = useState(false);
  const [postEditTitle, setPostEditTitle] = useState('');
  const [postEditBody, setPostEditBody] = useState('');
  const [postEditSaving, setPostEditSaving] = useState(false);
  const [postEditError, setPostEditError] = useState(false);
  const [postConfirmDelete, setPostConfirmDelete] = useState(false);
  const [postDeleting, setPostDeleting] = useState(false);

  const signInPath = '/login?redirect=' + encodeURIComponent(pathname + hash);

  // ── Actions ──────────────────────────────────────────────────────────────

  const toggleBookmark = async () => {
    if (!post) return;
    await fetch(`/api/community/posts/${post.id}/bookmark`, { method: 'POST' });
    setPost((p) => p ? { ...p, bookmarked: !p.bookmarked } : p);
  };

  const savePostEdit = async () => {
    if (!post || postEditSaving || (post.type === 'spark' && countSparkCharacters(postEditTitle) > SPARK_LIMIT)) return;
    setPostEditSaving(true);
    setPostEditError(false);
    const title = post.type === 'spark' ? postEditTitle.trim() : postEditTitle;
    try {
      const response = await fetch(`/api/community/posts/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post.type === 'spark' ? { title } : { title, body: postEditBody }),
      });
      if (!response.ok) throw new Error('Post edit failed');
      setPostEditMode(false);
      setPost((current) => current?.id === post.id ? { ...current, title, body: postEditBody } : current);
    } catch {
      setPostEditError(true);
    } finally {
      setPostEditSaving(false);
    }
  };

  const toggleConversationMute = async () => {
    if (!post || muting) return;
    setMuting(true);
    try {
      const response = await fetch('/api/community/mute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, muted: !post.muted }),
      });
      if (!response.ok) throw Error();
      const { muted } = await response.json() as { muted: boolean };
      setPost(current => current?.id === post.id ? { ...current, muted } : current);
      setMuteStatus(muted ? 'Conversation muted.' : 'Conversation unmuted.');
    } catch { setMuteStatus('Couldn’t change conversation notifications.'); }
    finally { setMuting(false); }
  };

  const deletePost = async () => {
    if (!post) return;
    setPostDeleting(true);
    const res = await fetch(`/api/community/posts/${post.id}`, { method: 'DELETE' });
    setPostDeleting(false);
    if (res.ok) navigate(post.categorySlug ? `/community/${post.categorySlug}` : '/community');
  };

  const handleReplyDeleted = (_replyId: number) => {
    reloadReplies();
    setPost((p) => p ? { ...p, replyCount: Math.max(0, p.replyCount - 1) } : p);
  };

  const acceptAnswer = async (replyId: number) => {
    if (!post) return;
    await fetch(`/api/community/posts/${post.id}/accept-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ replyId }),
    });
    setPost((p) => p ? { ...p, acceptedReplyId: replyId } : p);
  };

  const likeReply = async (replyId: number) => {
    await fetch(`/api/community/replies/${replyId}/like`, { method: 'POST' });
    reloadReplies();
  };

  const sharePost = async () => {
    const url = publicShareUrl(window.location.href);
    if (hasNativeShare()) {
      const result = await shareContent({ title: post?.title, url });
      if (result.method === 'clipboard') setShowShareToast(true);
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShowShareToast(true);
      } catch {
        return;
      }
    }
    setTimeout(() => setShowShareToast(false), 2000);
    // Track share count (fire-and-forget — non-critical)
    if (post?.id) {
      void fetch(`/api/community/posts/${post.id}/share`, {
        method: 'POST',
        credentials: 'include',
      });
    }
  };

  // ── Build threaded reply tree ─────────────────────────────────────────────

  const spark = post?.type === 'spark';
  const sparkAuthor = spark && post ? handleName(post) : undefined;
  const visibleReplies = new Map(replies.map(reply => [reply.id, reply]));
  const updateReply = (reply: CommunityReply) => setReplies(items => items.map(item => item.id === reply.id ? reply : item));
  const buildTree = (items: CommunityReply[], parentId: number | null = null, depth = 0): React.ReactNode[] => {
    return items
      .filter((r) => (r.parentId && visibleReplies.has(r.parentId) ? r.parentId : null) === parentId)
      .map((r) => (
        <ReplyCard
          key={r.id}
          reply={r}
          isAccepted={post?.acceptedReplyId === r.id}
          isPostAuthor={session?.user?.id === post?.userId}
          postType={post?.type ?? 'discussion'}
          postId={post?.id ?? 0}
          sparkContext={sparkAuthor && post ? {
            original: sparkAuthor,
            parent: parentId !== null && visibleReplies.has(parentId) ? handleName(visibleReplies.get(parentId)!) : sparkAuthor,
            audience: post.audience,
            locked: post.isLocked || !session,
            canInteract: !!session,
          } : undefined}
          onUpdate={updateReply}
          onAccept={acceptAnswer}
          onLike={likeReply}
          onReplyTo={setReplyTo}
          onDeleted={handleReplyDeleted}
          currentUserId={session?.user?.id}
          depth={depth}
        >
          {items.some(item => item.parentId === r.id) ? buildTree(items, r.id, depth + 1) : null}
        </ReplyCard>
      ));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const tags = post?.tags ? post.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const horoscope = loader?.readingPreview?.type === 'horoscope' ? loader.readingPreview : null;
  const readingType = loader?.readingPreview?.type ?? post?.sparkReading?.type;
  const readingTitle = horoscope ? `${horoscope.sign} · ${horoscope.date} · ${horoscope.headline}`
    : readingType === 'horoscope' ? 'A shared horoscope on Spellful' : readingType === 'natal' ? 'A shared natal chart on Spellful'
    : readingType === 'tarot' ? 'A shared tarot spread on Spellful' : null;
  const pageTitle = readingTitle ?? (post ? `${post.title || 'Spark'} — Spellful Community` : 'Discussion — Spellful Community');

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={readingTitle || post?.sparkReading ? 'A reading shared on Spellful' : post ? `${post.title} — community discussion on Spellful` : 'Community discussion'} />
        {(readingTitle || post?.sparkReading) && <>
          <meta property="og:title" content={readingTitle ?? 'A shared reading on Spellful'} />
          <meta property="og:description" content={horoscope?.body ?? "View the reading the author chose to share on Spellful."} />
        </>}
        <meta name="robots" content="noindex" />
      </Helmet>

      <main className={spark ? "spark-comments min-h-screen" : "min-h-screen"}>
        {/* Top bar */}
        {spark ? <div className="spark-comments-header">
          <Link aria-label="Back to feed" to="/"><ArrowLeft className="size-5" /></Link>
          <h1>Comments</h1>
        </div> : <div className="border-b border-border bg-[hsl(var(--card-deep))]">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <Link
              to={post?.categorySlug ? `/community/${post.categorySlug}` : '/community'}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              {post?.categoryName ?? community_post.backLabel}
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              style={{ fontFamily: 'var(--font-sans)' }}
            >
              ✦ Spellful Home
            </Link>
          </div>
        </div>}

        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
          {/* ── Post ── */}
          {postLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center">
              <p className="text-sm text-muted-foreground">{community_post.notFoundText}</p>
              <Link to="/community"><Button variant="outline" size="sm" className="mt-4">{community_post.backToCommunityLabel}</Button></Link>
            </div>
          ) : post ? (
            <article className={spark ? "spark-original" : "relative rounded-xl border border-border bg-card p-5 md:p-6"}>
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {post.type === 'question' && (
                  <Badge variant="outline" className="gap-1 text-accent border-accent/40 text-xs">
                    <HelpCircle className="w-3 h-3" /> Question
                  </Badge>
                )}
                {post.acceptedReplyId && (
                  <Badge variant="outline" className="gap-1 text-[hsl(var(--success))] border-[hsl(var(--success))]/40 text-xs">
                    <CheckCircle2 className="w-3 h-3" /> Solved
                  </Badge>
                )}
                {post.isPinned && <Badge variant="outline" className="gap-1 text-primary border-primary/40 text-xs"><Pin className="w-3 h-3" /> Pinned</Badge>}
                {post.isLocked && <Badge variant="outline" className="gap-1 text-muted-foreground text-xs"><Lock className="w-3 h-3" /> Locked</Badge>}
                {post.type !== 'spark' && post.categoryName && (
                  <Link to={`/community/${post.categorySlug}`}>
                    <Badge variant="secondary" className="text-xs hover:bg-secondary/80 transition-colors">{post.categoryName}</Badge>
                  </Link>
                )}
              </div>

              {/* Title */}
              {spark ? <p className="spark-original-text">{post.title}</p> : <h1 className="font-heading text-xl md:text-2xl text-foreground mb-4 whitespace-pre-wrap break-words leading-snug">{post.title}</h1>}

              {/* Author */}
              <div className="spark-original-author flex items-center gap-2 mb-4">
                <Avatar name={post.authorName} image={post.authorImage} size={8} />
                <div>
                  <Link
                    to={post.authorUsername ? `/u/${post.authorUsername}` : '#'}
                    className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                  >
                    {post.authorName ?? 'Unknown'}
                  </Link>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs text-muted-foreground">
                      {spark && post.authorUsername && <><CommentHandle name={`@${post.authorUsername}`} /> · </>}{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                      {post.updatedAt !== post.createdAt && ' · edited'}
                    </p>
                    {post.authorLocation && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground/70">
                        <MapPin className="w-2.5 h-2.5" />{post.authorLocation}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Hero image */}
              {spark && post.sparkTopic && <Link className="inline-flex min-h-8 items-center text-xs text-primary" to={topicPath(post.sparkTopic)}>{post.sparkTopic}</Link>}
              {spark && post.sparkReading && <SparkReadingAttachment reading={post.sparkReading} postId={post.id} />}
              {spark && <SparkMediaGallery media={post.sparkMedia} />}
              {spark && post.originalSparkId && <OriginalSparkCard spark={post.originalSpark} />}
              {!post.sparkMedia?.length && post.imageUrl && (
                <img
                  src={uploadedMediaUrl(post.imageUrl)}
                  alt=""
                  className="w-full rounded-lg object-cover max-h-72 mb-4"
                  loading="lazy"
                />
              )}

              {/* Body */}
              {post.type !== 'spark' && <CommunityPostBody html={post.body} />}

              {/* Poll */}
              {post.poll && (
                <PollBlock poll={post.poll} postId={post.id} onVoted={reloadPost} />
              )}

              {/* Tags */}
              {!spark && tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground mt-0.5" />
                  {tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {session && <div className="absolute right-1 top-0 z-10">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><button className="grid size-11 place-items-center" type="button" aria-label="Conversation options"><MoreHorizontal size={18} /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem disabled={muting} onSelect={() => void toggleConversationMute()}>
                      {post.muted ? 'Unmute conversation' : 'Mute conversation'}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>}
              {muteStatus && <p role="status" className="text-xs text-muted-foreground">{muteStatus}</p>}
              {/* Action bar */}
              <div className="spark-original-actions flex items-center gap-2 mt-5 pt-4 border-t border-border/50 flex-wrap">
                {post.type === 'spark' ? <SparkActions post={post} canInteract={!!session} /> : <SparkHeartButton regularLike postId={post.id} liked={post.liked} likeCount={post.likeCount} />}
                {post.type !== 'spark' && !!post.likedBy?.length && <p className="text-xs">Liked by {post.likedBy.join(', ')}{post.likeCount > post.likedBy.length ? ` and ${post.likeCount - post.likedBy.length} others` : ''}</p>}

                {post.type !== 'spark' && (
                <button
                  onClick={toggleBookmark}
                  className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                    post.bookmarked
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:text-foreground hover:border-primary/40'
                  }`}
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  {post.bookmarked ? community_post.savedLabel : community_post.saveLabel}
                </button>
                )}

                {post.type !== 'spark' && post.audience === 'public' && !post.isHidden && (
                  <Link
                    to={'/community/new?quote=' + post.id}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> {spark ? "Quote or reshare" : "Quote post"}
                  </Link>
                )}

                <button
                  onClick={sharePost}
                  className="relative flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {community_post.shareLabel}
                  <AnimatePresence>
                    {showShareToast && (
                      <motion.span
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="absolute -top-7 left-1/2 -translate-x-1/2 text-[10px] bg-foreground text-background px-2 py-0.5 rounded whitespace-nowrap"
                      >
                        {community_post.copiedLabel}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                {session?.user?.id === post.userId ? (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => { setPostEditTitle(post.title); setPostEditBody(post.body); setPostEditError(false); setPostEditMode(true); }}
                      className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => setPostConfirmDelete(true)}
                      className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                    <button
                      onClick={() => setAppealOpen(true)}
                      className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                      title="Appeal a moderation decision"
                    >
                      <Scale className="w-3.5 h-3.5" /> Appeal
                    </button>
                  </div>
                ) : (
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      onClick={() => setPostReportOpen(true)}
                      className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-lg text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" /> {community_post.reportLabel}
                    </button>
                  </div>
                )}

                {!spark && <div className="flex items-center gap-3 text-xs text-muted-foreground ml-2">
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.viewCount}</span>
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> {post.replyCount}</span>
                </div>}
              </div>
            </article>
          ) : null}

          {/* Post confirm delete */}
          <AnimatePresence>
            {postConfirmDelete && post && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 flex items-center justify-between gap-3"
              >
                <p className="text-sm text-destructive font-medium">Delete this post and all its replies?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPostConfirmDelete(false)}
                    className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={deletePost}
                    disabled={postDeleting}
                    className="text-xs px-3 py-1.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                  >
                    {postDeleting ? 'Deleting…' : 'Delete post'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Post edit form */}
          <AnimatePresence>
            {postEditMode && post && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-xl border border-primary/40 bg-card p-5 space-y-4"
              >
                <h2 className="text-sm font-semibold text-foreground">{post.type === 'spark' ? 'Edit Spark' : 'Edit post'}</h2>
                {post.type === 'spark' ? (
                  <div>
                    <label className="sr-only" htmlFor="edit-spark">Your Spark</label>
                    <textarea id="edit-spark" rows={3} value={postEditTitle} onChange={event => setPostEditTitle(event.target.value)}
                      aria-describedby="edit-spark-count" className="w-full rounded-lg border border-border bg-muted px-3 py-2" />
                    <p id="edit-spark-count" className="text-xs text-muted-foreground">{countSparkCharacters(postEditTitle)}/{SPARK_LIMIT} characters</p>
                  </div>
                ) : (
                  <>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Title</label>
                  <input
                    type="text"
                    value={postEditTitle}
                    onChange={(e) => setPostEditTitle(e.target.value)}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Body</label>
                  <textarea
                    value={postEditBody}
                    onChange={(e) => setPostEditBody(e.target.value)}
                    rows={8}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                  </>
                )}
                {postEditError && <p role="alert" className="text-sm text-destructive">Couldn’t save your changes. Try again.</p>}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setPostEditMode(false)}
                    className="text-xs px-3 py-1.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={savePostEdit}
                    disabled={postEditSaving || (!postEditTitle.trim() && !post.sparkMedia?.length && !post.sparkReading && !post.originalSparkId) || (post.type === 'spark' && countSparkCharacters(postEditTitle) > SPARK_LIMIT)}
                    className="text-xs px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {postEditSaving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Post report modal */}
          {post && (
            <ReportModal
              open={postReportOpen}
              onClose={() => setPostReportOpen(false)}
              targetType="post"
              targetId={post.id}
            />
          )}

          {appealOpen && post && <AppealModal targetType="post" targetId={post.id} onClose={() => setAppealOpen(false)} />}
          {post && missingReply && <p role="status" className="py-2 text-sm text-muted-foreground">That reply is unavailable. You can still read the conversation.</p>}
          {/* ── Replies ── */}
          {post && (
            <section>
              <div className={spark ? "sr-only" : "flex items-center justify-between mb-3"}>
                <h2 className="text-sm font-semibold text-foreground">
                  {post.replyCount} {post.replyCount === 1 ? 'Reply' : 'Replies'}
                </h2>
                <div className="flex items-center gap-1">
                  {!spark && (['chrono', 'liked'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSort(s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        sort === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s === 'chrono' ? community_post.sortOldest : community_post.sortTop}
                    </button>
                  ))}
                </div>
              </div>

              {repliesLoading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
                </div>
              ) : repliesError ? (
                <p role="status" className="py-2 text-sm">Couldn’t load replies. <button type="button" onClick={reloadReplies} className="text-primary underline">Try again</button></p>
              ) : replies.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center">
                  <Sparkles className="w-6 h-6 text-primary/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">{community_post.noRepliesText}</p>
                </div>
              ) : (
                <div className={spark ? "spark-comment-thread" : "space-y-3"}>
                  {buildTree(replies)}
                </div>
              )}
            </section>
          )}

          {post && !spark && !post.isLocked && session?.user?.id === post.userId && (
            <Link
              to={`/tarot?followUp=${post.id}`}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-primary hover:border-primary"
            >
              <Sparkles className="h-4 w-4" /> Draw tarot for a follow-up
            </Link>
          )}

          {post && !session && !isPending && <Link className="text-sm text-primary" to={signInPath}>Sign in to reply</Link>}
          {/* ── Composer ── */}
          {post && session && (
            <ReplyComposer
              sparkAuthor={sparkAuthor}
              canFollowUp={!spark && session?.user?.id === post.userId}
              postId={post.id}
              replyTo={replyTo}
              onClear={() => setReplyTo(null)}
              onSubmitted={() => { reloadReplies(); setPost(current => current ? { ...current, replyCount: current.replyCount + 1 } : current); }}
              isLocked={post.isLocked}
            />
          )}
        </div>
      </main>
    </>
  );
}
