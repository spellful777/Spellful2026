import { useState } from 'react';
import { Heart, MessageCircle, Share, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { publicShareUrl } from '@/lib/share-studio';
import { sparkReplyPath } from '@/lib/spark-comments';
import type { CommunityReply } from '@/hooks/useCommunityPost';

export function SparkCommentActions({ reply, onReply, locked, canInteract = true, audience, onUpdate }: {
  reply: CommunityReply;
  onReply: () => void;
  locked: boolean;
  canInteract?: boolean;
  audience: string | null;
  onUpdate: (reply: CommunityReply) => void;
}) {
  const [pending, setPending] = useState(false);
  const [share, setShare] = useState(false);
  const [status, setStatus] = useState('');
  const url = () => publicShareUrl(new URL(sparkReplyPath(reply.postId, reply.id), window.location.href).href);

  async function change(action: 'liked' | 'favorited') {
    setPending(true);
    setStatus('');
    try {
      const res = await fetch(`/api/community/replies/${reply.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [action]: !reply[action] }),
      });
      if (!res.ok) throw new Error();
      onUpdate({ ...reply, ...await res.json() });
    } catch {
      setStatus('Couldn’t save that change. Try again.');
    } finally {
      setPending(false);
    }
  }

  return <>
    <div className="spark-comment-actions">
      <button type="button" onClick={onReply} disabled={locked} aria-label="Reply"><MessageCircle /></button>
      <button type="button" onClick={() => change('liked')} disabled={pending || !canInteract} aria-pressed={reply.liked}
        aria-label={`${reply.liked ? 'Unlike' : 'Like'} · ${reply.likeCount ?? 0} likes`}><Heart />{reply.likeCount ?? 0}</button>
      <button type="button" onClick={() => { setStatus(''); setShare(true); }} aria-label="Share reply"><Share /></button>
      <button type="button" onClick={() => change('favorited')} disabled={pending || !canInteract} aria-pressed={Boolean(reply.favorited)}
        aria-label={reply.favorited ? 'Remove reply from Favorites' : 'Add reply to Favorites'}><Star /></button>
    </div>
    {!!reply.likedBy?.length && <p className="text-xs text-muted-foreground">
      Liked by {reply.likedBy.join(', ')}{reply.likeCount > reply.likedBy.length ? ` and ${reply.likeCount - reply.likedBy.length} others` : ''}
    </p>}
    {!share && status && status !== 'Link copied.' && status !== 'Select and copy the link above.' && <p role="status" className="text-xs">{status}</p>}
    <Dialog open={share} onOpenChange={setShare}>
      <DialogContent className="max-w-sm">
        <DialogTitle>Share reply</DialogTitle>
        <DialogDescription>{audience === 'public'
          ? 'This link opens the original Post at this reply.'
          : 'Only members with access to the original Post can open this reply.'}</DialogDescription>
        <input aria-label="Reply link" readOnly value={share ? url() : ''} onFocus={event => event.target.select()} className="w-full rounded border border-border bg-background p-2" />
        <button type="button" className="min-h-11 rounded border border-border" onClick={async () => {
          try {
            await navigator.clipboard.writeText(url());
            setStatus('Link copied.');
          } catch {
            setStatus('Select and copy the link above.');
          }
        }}>Copy link</button>
        {status && <p role="status" className="text-xs">{status}</p>}
      </DialogContent>
    </Dialog>
  </>;
}
