import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';

export function useSparkFavorite(postId: number, bookmarked: boolean, onChanged?: (saved: boolean) => void) {
  const [saved, setSaved] = useState(bookmarked);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => setSaved(bookmarked), [postId, bookmarked]);

  async function toggle() {
    if (pending) return;
    setPending(true);
    setFailed(false);
    try {
      const response = await fetch(`/api/community/posts/${postId}/bookmark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarked: !saved }),
      });
      if (!response.ok) throw new Error('Favorite could not be saved');
      const result: { bookmarked: boolean } = await response.json();
      setSaved(result.bookmarked);
      onChanged?.(result.bookmarked);
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  return { saved, pending, failed, toggle };
}

export default function SparkFavoriteButton({ postId, bookmarked }: { postId: number; bookmarked: boolean }) {
  const { saved, pending, failed, toggle } = useSparkFavorite(postId, bookmarked);
  return (
    <>
      <button
        type="button"
        aria-label="Favorite Post"
        aria-pressed={saved}
        aria-disabled={pending}
        title={saved ? 'Remove from Favorites' : 'Save to Favorites'}
        onClick={toggle}
        className={`coven-press inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors hover:bg-muted hover:text-primary focus-visible:outline focus-visible:outline-primary ${saved ? 'text-primary' : 'text-muted-foreground'}`}
      >
        <Star className={`size-4 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
      </button>
      {failed && <span role="status" className="sr-only">Couldn’t update Favorites. Try again.</span>}
    </>
  );
}
