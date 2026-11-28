import { SparkReadingAttachment } from '@/components/SparkReadingAttachment';
import { topicPath } from '@/lib/spark-topics';
import { OriginalSparkCard, SparkMediaGallery } from '@/components/SparkMediaGallery';
import { SparkByline } from '@/components/SparkByline';
import { MoreHorizontal } from 'lucide-react';
import { Link } from 'react-router';
import { SparkActions } from '@/components/SparkActions';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { CommunityPost } from '@/hooks/useCommunity';

export default function SparkCard({ post, canInteract = true, onFavorite, onSave }: { post: CommunityPost; canInteract?: boolean; onFavorite?: (value: { liked: boolean; likeCount: number }) => void; onSave?: (value: boolean) => void }) {
  const name = post.authorName ?? post.authorUsername ?? 'Member';
  const destination = `/community/post/${post.id}`;

  return (
    <article data-feed-post-id={post.id} className="timeline-spark">
      <div className="spark-heading">
        <SparkByline author={post} createdAt={post.createdAt} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`More actions for ${name}’s Spark`} className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-primary">
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="home-social-menu [&_[role=menuitem]:focus]:text-background">
            <DropdownMenuItem asChild><Link to={destination}>View Spark</Link></DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void navigator.clipboard?.writeText(new URL(destination, location.origin).href).catch(() => {})}>Copy link</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <Link to={destination} className="spark-text">
        {post.title}
      </Link>
      {!post.sparkMedia?.length && post.imageUrl && /^https:\/\//i.test(post.imageUrl) && (
          <Link to={destination} aria-label="Open photo Spark"><img src={post.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="mt-2 aspect-video w-full rounded-lg object-cover" /></Link>
      )}
      {post.sparkTopic && <Link className="inline-flex min-h-8 items-center text-xs text-primary" to={topicPath(post.sparkTopic)}>{post.sparkTopic}</Link>}
      <SparkMediaGallery media={post.sparkMedia} />
      {post.sparkReading && <SparkReadingAttachment reading={post.sparkReading} postId={post.id} />}
      {post.reshareOf && <p className="text-xs text-muted-foreground">Reshared by {name}</p>}
      {post.originalSparkId && <OriginalSparkCard spark={post.originalSpark} />}
      <SparkActions post={post} canInteract={canInteract} onFavorite={onFavorite} onSave={onSave} />
    </article>
  );
}
