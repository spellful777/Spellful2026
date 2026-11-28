import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Repeat2, Share, Star } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router';
import { ReportModal } from './ReportModal';
import SparkHeartButton from '@/components/SparkHeartButton';
import { useSparkFavorite } from '@/components/SparkFavoriteButton';
import { SPARK_COMPOSE } from '@/lib/community-navigation';

import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { publicShareUrl } from '@/lib/share-studio';

type SparkActionData = {
  type?: string;
  id: number; audience?: string | null; reshareOf?: number | null; originalSpark?: { id: number } | null;
  likeCount: number; replyCount: number; liked: boolean; bookmarked: boolean;
  reshared?: boolean; reshareCount?: number;
};
export function SparkActions({ post, canInteract = true, onReply, onFavorite, onSave, thread, cardAuthor, compact = false }: {
  post: SparkActionData;
  onReply?: () => void;
  cardAuthor?: string;
  compact?: boolean;
  thread?: { locked: boolean; onReply: () => void; onShare: () => void; menu: ReactNode };
  canInteract?: boolean;
  onFavorite?: (reaction: { liked: boolean; likeCount: number }) => void;
  onSave?: (saved: boolean) => void;
}) {
  const [reshare, setReshare] = useState({ active: !!post.reshared, count: post.reshareCount ?? 0 });
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const shareAfterMenu = useRef(false);
  const destination = '/community/post/' + post.id;
  const [shareOpen, setShareOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const shareUrl = shareOpen ? publicShareUrl(new URL('/community/post/' + post.id, window.location.href).href) : '';
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState(false);
  const original = post.reshareOf ?? post.id;
  const shareable = post.type !== 'discussion' && post.type !== 'question' && post.audience === 'public' && (!post.reshareOf || !!post.originalSpark);
  const { saved, pending, failed, toggle } = useSparkFavorite(post.id, post.bookmarked, onSave);
  useEffect(() => { setReshare({ active: !!post.reshared, count: post.reshareCount ?? 0 }); }, [post.id, post.reshared, post.reshareCount]);
  async function toggleReshare() {
    if (working) return;
    setWorking(true);
    setError('');
    try {
      const response = await fetch('/api/community/posts/' + original + '/reshare', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reshared: !reshare.active }),
      });
      if (!response.ok) throw Error();
      const result = await response.json();
      setReshare({ active: result.reshared, count: result.reshareCount });
    } catch { setError('Couldn’t update your reshare. Try again.'); }
    finally { setWorking(false); }
  }
  if (thread) return <>
    <div className="spark-comment-actions">
      <button type="button" aria-label="Reply to Post" disabled={!canInteract || thread.locked} onClick={thread.onReply}><MessageCircle /></button>
      {canInteract ? <SparkHeartButton postId={post.id} liked={post.liked} likeCount={post.likeCount ?? 0} onChanged={onFavorite} />
        : <button type="button" disabled aria-label={post.likeCount + ' likes'}><Heart />{post.likeCount ?? 0}</button>}
      <button type="button" aria-label="Share Post" onClick={thread.onShare}><Share /></button>
      <button type="button" aria-label={saved ? 'Remove from Saved Posts' : 'Save Post'} aria-pressed={saved} disabled={!canInteract || pending} onClick={toggle}><Star /></button>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className="spark-thread-more" aria-label="Conversation options"><MoreHorizontal /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!canInteract || !shareable || working} onSelect={toggleReshare}>{reshare.active ? 'Undo reshare' : 'Reshare'} · {reshare.count}</DropdownMenuItem>
        {canInteract && shareable && <DropdownMenuItem asChild><Link to={SPARK_COMPOSE + '&quote=' + original}>Quote Post</Link></DropdownMenuItem>}
        {thread.menu}
      </DropdownMenuContent>
    </DropdownMenu>
    {(failed || error) && <p role="status" className="text-xs">{error || 'Couldn’t update Saved Posts. Try again.'}</p>}
  </>;
  return <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button ref={menuTrigger} type="button" aria-label={`More actions for ${cardAuthor}’s Post`} className="spark-card-menu-trigger">
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="home-social-menu [&_[role=menuitem]:focus]:text-background"
        onCloseAutoFocus={event => {
          if (shareAfterMenu.current) {
            event.preventDefault();
            shareAfterMenu.current = false;
            setShareOpen(true);
          }
        }}>
        <DropdownMenuItem asChild><Link to={destination}>View Post</Link></DropdownMenuItem>
        {compact && <>
          <DropdownMenuItem disabled={!canInteract || !shareable || working} onSelect={toggleReshare}>
            {reshare.active ? 'Undo reshare' : 'Reshare'} · {reshare.count}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canInteract || pending} onSelect={() => void toggle()}>
            {saved ? 'Remove from Saved Posts' : 'Save Post'}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { shareAfterMenu.current = true; }}>Share Post</DropdownMenuItem>
        </>}
        {canInteract && <DropdownMenuItem onSelect={() => setReport(true)}>Report post</DropdownMenuItem>}
        <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(new URL(destination, location.origin).href).catch(() => {})}>Copy link</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    {report && <ReportModal targetType="post" targetId={post.id} onClose={() => setReport(false)} />}
    <div className="spark-actions">
      {canInteract ? <SparkHeartButton postId={post.id} liked={post.liked} likeCount={post.likeCount ?? 0} onChanged={onFavorite} />
        : <span aria-label={(post.likeCount ?? 0) + ' favorites'}><Heart size={17} aria-hidden="true" /> {post.likeCount ?? 0}</span>}
      {onReply && canInteract ? <button type="button" aria-label="Reply" onClick={onReply}><MessageCircle size={17} /> {post.replyCount}</button> : (<Link to={'/community/post/' + post.id} aria-label={`Comments, ${post.replyCount ?? 0} total`}>
        <MessageCircle size={17} aria-hidden="true" /> {post.replyCount ?? 0}
      </Link>)}
      {!compact && <>
        <button type="button" aria-label={`${reshare.active ? 'Undo reshare' : 'Reshare'}, ${reshare.count} total`}
        aria-pressed={reshare.active} disabled={!canInteract || !shareable || working} onClick={toggleReshare}>
        <Repeat2 size={17} aria-hidden="true" /> {reshare.count}
        </button>
        <button type="button" aria-label={saved ? 'Remove from Saved Posts' : 'Save Post'} aria-pressed={saved}
        disabled={!canInteract || pending} onClick={() => void toggle()}>
        <Bookmark size={17} className={saved ? 'fill-current' : ''} aria-hidden="true" />
        </button>
      </>}
      <Dialog open={shareOpen} onOpenChange={open => { setShareOpen(open); setCopyStatus(''); }}>
        {!compact && <DialogTrigger asChild><button type="button" aria-label="Share Post"><Share size={17} /></button></DialogTrigger>}
        <DialogContent className="max-w-sm" onCloseAutoFocus={event => {
          if (compact) { event.preventDefault(); menuTrigger.current?.focus(); }
        }}>
          <DialogTitle>Share Post</DialogTitle>
          <DialogDescription>{post.audience === 'public' ? 'Share a link to this Post.' : 'Only people with access can open this Post.'}</DialogDescription>
          <input readOnly aria-label="Post link" className="w-full rounded border border-border bg-background p-2" value={shareUrl} onFocus={event => event.target.select()} />
          <button type="button" className="min-h-11 rounded-lg border border-border" onClick={async () => {
            try { await navigator.clipboard.writeText(shareUrl); setCopyStatus('Link copied.'); }
            catch { setCopyStatus('Select and copy the link above.'); }
          }}>Copy link</button>
          {canInteract && shareable && <Link className="min-h-11 text-center text-primary underline" to={SPARK_COMPOSE + '&quote=' + original}>Quote Post</Link>}
          {copyStatus && <p role="status">{copyStatus}</p>}
        </DialogContent>
      </Dialog>
    </div>
    {(failed || error) && <p role="status" className="px-2 text-xs">{error || 'Couldn’t update Saved Posts. Try again.'}</p>}
  </>;
}
