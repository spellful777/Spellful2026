import { formatDistanceToNowStrict } from 'date-fns';
import { MessageSquare, MoreHorizontal, Star } from 'lucide-react';
import { Link } from 'react-router';
import SparkHeartButton from '@/components/SparkHeartButton';
import { useSparkFavorite } from '@/components/SparkFavoriteButton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { CommunityPost } from '@/hooks/useCommunity';

export default function SparkCard({ post }: { post: CommunityPost }) {
  const name = post.authorName ?? post.authorUsername ?? 'Member';
  const destination = `/community/post/${post.id}`;
  const { saved, pending, failed, toggle } = useSparkFavorite(post.id, post.bookmarked);
  const author = (
    <span className="flex min-w-0 items-center gap-3">
      {post.authorImage ? (
        <img src={post.authorImage} alt="" width={44} height={44} loading="lazy" className="size-11 shrink-0 rounded-full border border-border object-cover" />
      ) : (
        <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-heading text-base">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-heading text-lg font-bold leading-tight text-foreground">{name}</span>
        <time className="block text-xs text-muted-foreground" dateTime={post.createdAt}>
          {formatDistanceToNowStrict(new Date(post.createdAt), { addSuffix: true })}
        </time>
      </span>
    </span>
  );

  return (
    <article data-feed-post-id={post.id} className="rounded-xl border border-border bg-card px-3 pb-1 pt-2.5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        {post.authorUsername ? (
          <Link to={`/u/${encodeURIComponent(post.authorUsername)}`} className="min-w-0 rounded-md hover:underline focus-visible:outline focus-visible:outline-primary">{author}</Link>
        ) : author}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`More actions for ${name}’s Spark`} className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-primary">
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="home-social-menu [&_[role=menuitem]:focus]:text-background">
            <DropdownMenuItem disabled={pending} onSelect={event => { event.preventDefault(); void toggle(); }}>
              <Star className={saved ? 'fill-current' : undefined} aria-hidden="true" />
              {saved ? 'Remove from Favorites' : 'Add to Favorites'}
            </DropdownMenuItem>
            <DropdownMenuItem asChild><Link to={destination}>View Spark</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Link to={destination} className="mt-2 block whitespace-pre-wrap break-words rounded-md font-heading text-[1.1rem] leading-snug text-foreground hover:underline focus-visible:outline focus-visible:outline-primary">
        {post.title}
        {post.imageUrl && /^https:\/\//i.test(post.imageUrl) && (
          <img src={post.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="mt-2 aspect-video w-full rounded-lg object-cover" />
        )}
      </Link>
      <div className="-ml-1 mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        <SparkHeartButton postId={post.id} liked={post.liked} likeCount={post.likeCount} />
        <Link to={destination} aria-label={`Open Spark with ${post.replyCount} replies`} className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-1 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-primary">
          <MessageSquare className="size-4" aria-hidden="true" /> {post.replyCount}
        </Link>
      </div>
      {failed && <span role="status" className="sr-only">Couldn’t update Favorites. Try again.</span>}
    </article>
  );
}
