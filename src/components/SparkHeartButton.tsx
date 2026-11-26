import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

interface Reaction {
  liked: boolean;
  likeCount: number;
}

interface SparkHeartButtonProps extends Reaction {
  postId: number;
}

export default function SparkHeartButton({ postId, liked, likeCount }: SparkHeartButtonProps) {
  const [reaction, setReaction] = useState<Reaction>({ liked, likeCount });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => setReaction({ liked, likeCount }), [liked, likeCount, postId]);

  async function toggleHeart() {
    if (pending) return;
    const previous = reaction;
    const next = {
      liked: !previous.liked,
      likeCount: Math.max(0, previous.likeCount + (previous.liked ? -1 : 1)),
    };
    setReaction(next);
    setPending(true);
    setError(false);

    try {
      const response = await fetch(`/api/community/posts/${postId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: next.liked }),
      });
      if (!response.ok) throw new Error('Heart update failed');
      const result: { liked: boolean; likeCount?: number } = await response.json();
      setReaction({ liked: result.liked, likeCount: result.likeCount ?? next.likeCount });
    } catch {
      setReaction(previous);
      setError(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="relative z-10 inline-flex">
      <button
        type="button"
        aria-label={`Heart this Spark, ${reaction.likeCount} ${reaction.likeCount === 1 ? 'heart' : 'hearts'}`}
        aria-pressed={reaction.liked}
        aria-disabled={pending}
        onClick={toggleHeart}
        className={`coven-press inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 transition-colors focus-visible:outline focus-visible:outline-primary ${
          reaction.liked ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-primary'
        }`}
      >
        <Heart className={`size-4 ${reaction.liked ? 'fill-current' : ''}`} aria-hidden="true" />
        <span aria-hidden="true">{reaction.likeCount}</span>
      </button>
      {error && <span role="status" className="sr-only">Couldn’t update your heart. Try again.</span>}
    </span>
  );
}
