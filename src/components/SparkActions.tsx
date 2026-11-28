import { useEffect, useState, type ReactNode } from 'react';
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Quote, Repeat2, Share, Star } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router';
import SparkHeartButton from '@/components/SparkHeartButton';
import { useSparkFavorite } from '@/components/SparkFavoriteButton';
import { SPARK_COMPOSE } from '@/lib/community-navigation';

type SparkActionData = {
  id: number; audience?: string | null; reshareOf?: number | null; originalSpark?: { id: number } | null;
  likeCount: number; replyCount: number; liked: boolean; bookmarked: boolean;
  reshared?: boolean; reshareCount?: number;
};
export function SparkActions({ post, canInteract = true, onFavorite, onSave, thread }: {
  post: SparkActionData;
  thread?: { locked: boolean; onReply: () => void; onShare: () => void; menu: ReactNode };
  canInteract?: boolean;
  onFavorite?: (reaction: { liked: boolean; likeCount: number }) => void;
  onSave?: (saved: boolean) => void;
}) {
  const [reshare, setReshare] = useState({ active: !!post.reshared, count: post.reshareCount ?? 0 });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const original = post.reshareOf ?? post.id;
  const shareable = post.audience === 'public' && (!post.reshareOf || !!post.originalSpark);
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
      <button type="button" aria-label="Reply to Spark" disabled={!canInteract || thread.locked} onClick={thread.onReply}><MessageCircle /></button>
      {canInteract ? <SparkHeartButton postId={post.id} liked={post.liked} likeCount={post.likeCount ?? 0} onChanged={onFavorite} />
        : <button type="button" disabled aria-label={post.likeCount + ' likes'}><Heart />{post.likeCount ?? 0}</button>}
      <button type="button" aria-label="Share Spark" onClick={thread.onShare}><Share /></button>
      <button type="button" aria-label={saved ? 'Remove from Saved Sparks' : 'Save Spark'} aria-pressed={saved} disabled={!canInteract || pending} onClick={toggle}><Star /></button>
    </div>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className="spark-thread-more" aria-label="Conversation options"><MoreHorizontal /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!canInteract || !shareable || working} onSelect={toggleReshare}>{reshare.active ? 'Undo reshare' : 'Reshare'} · {reshare.count}</DropdownMenuItem>
        {canInteract && shareable && <DropdownMenuItem asChild><Link to={SPARK_COMPOSE + '&quote=' + original}>Quote Spark</Link></DropdownMenuItem>}
        {thread.menu}
      </DropdownMenuContent>
    </DropdownMenu>
    {(failed || error) && <p role="status" className="text-xs">{error || 'Couldn’t update Saved Sparks. Try again.'}</p>}
  </>;
  return <>
    <div className="spark-actions">
      {canInteract ? <SparkHeartButton postId={post.id} liked={post.liked} likeCount={post.likeCount ?? 0} onChanged={onFavorite} />
        : <span aria-label={(post.likeCount ?? 0) + ' favorites'}>♡ {post.likeCount ?? 0}</span>}
      <Link to={'/community/post/' + post.id} aria-label={`Comments, ${post.replyCount ?? 0} total`}>
        <MessageCircle size={17} aria-hidden="true" /> {post.replyCount ?? 0}
      </Link>
      <button type="button" aria-label={`${reshare.active ? 'Undo reshare' : 'Reshare'}, ${reshare.count} total`}
        aria-pressed={reshare.active} disabled={!canInteract || !shareable || working} onClick={toggleReshare}>
        <Repeat2 size={17} aria-hidden="true" /> {reshare.count}
      </button>
      {canInteract && shareable ? <Link aria-label="Quote Spark" to={SPARK_COMPOSE + '&quote=' + original}><Quote size={17} aria-hidden="true" /></Link>
        : <button type="button" aria-label="Quote Spark" disabled><Quote size={17} aria-hidden="true" /></button>}
      <button type="button" aria-label={saved ? 'Remove from Saved Sparks' : 'Save Spark'} aria-pressed={saved}
        disabled={!canInteract || pending} onClick={() => void toggle()}>
        <Bookmark size={17} className={saved ? 'fill-current' : ''} aria-hidden="true" />
      </button>
    </div>
    {(failed || error) && <p role="status" className="px-2 text-xs">{error || 'Couldn’t update Saved Sparks. Try again.'}</p>}
  </>;
}
