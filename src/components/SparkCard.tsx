import { formatDistanceToNow } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router';
import SparkHeartButton from '@/components/SparkHeartButton';
import SparkFavoriteButton from '@/components/SparkFavoriteButton';
import type { CommunityPost } from '@/hooks/useCommunity';

export default function SparkCard({ post }: { post: CommunityPost }) {
  const name = post.authorUsername ?? post.authorName ?? 'Member';
  const displayName = post.authorUsername ? `@${post.authorUsername}` : name;
  const destination = `/community/post/${post.id}`;
  const author = (
    <>
      {post.authorImage ? (
        <img src={post.authorImage} alt="" width={32} height={32} loading="lazy" className="mx-auto size-8 rounded-full object-cover" />
      ) : (
        <span aria-hidden="true" className="mx-auto flex size-8 items-center justify-center rounded-full bg-muted font-heading text-sm">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="mt-1 block truncate text-xs" title={displayName}>{displayName}</span>
    </>
  );

  return (
    <article data-feed-post-id={post.id} className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-2 rounded-xl border border-border bg-card px-3 pb-1 pt-3">
      <div className="min-w-0 text-center text-muted-foreground">
        {post.authorUsername ? (
          <Link to={`/u/${encodeURIComponent(post.authorUsername)}`} className="block rounded-sm hover:text-foreground focus-visible:outline focus-visible:outline-primary">
            {author}
          </Link>
        ) : author}
      </div>
      <div className="min-w-0">
        <Link to={destination} className="block whitespace-pre-wrap break-words rounded-sm text-sm leading-snug text-foreground hover:underline focus-visible:outline focus-visible:outline-primary">
          {post.title}
        </Link>
        <div className="flex flex-wrap items-center text-xs text-muted-foreground">
          <SparkHeartButton postId={post.id} liked={post.liked} likeCount={post.likeCount} />
          <Link to={destination} aria-label={`Open Spark with ${post.replyCount} replies`} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg px-1 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-primary">
            <MessageSquare className="size-3.5" aria-hidden="true" /> {post.replyCount}
          </Link>
          <SparkFavoriteButton postId={post.id} bookmarked={post.bookmarked} />
          <time className="ml-auto text-[11px]" dateTime={post.createdAt}>{formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}</time>
        </div>
      </div>
    </article>
  );
}
