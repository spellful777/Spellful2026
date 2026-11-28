import { useEffect, useRef, useState } from 'react';
import { CommunityPostBody } from './CommunityPostBody';
import { ReplyComposer, type ReplyTarget } from './CommunityReplyComposer';
import { sparkReplyPath } from '@/lib/spark-comments';
import { SparkReadingAttachment } from '@/components/SparkReadingAttachment';
import { topicPath } from '@/lib/spark-topics';
import { OriginalSparkCard, SparkMediaGallery } from '@/components/SparkMediaGallery';
import { SparkByline } from '@/components/SparkByline';
import { Link } from 'react-router';
import { SparkActions } from '@/components/SparkActions';
import type { CommunityPost } from '@/hooks/useCommunity';

export default function SparkCard({ post, compact = false, canInteract = true, onFavorite, onSave }: { post: CommunityPost; compact?: boolean; canInteract?: boolean; onFavorite?: (value: { liked: boolean; likeCount: number }) => void; onSave?: (value: boolean) => void }) {
  const [target, setTarget] = useState<ReplyTarget | null>(null);
  const [compose, setCompose] = useState(false);
  const [sent, setSent] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);
  const field = useRef<HTMLTextAreaElement>(null);
  function reply(to: ReplyTarget | null) { setTarget(to); setCompose(true); }
  useEffect(() => { if (compose) field.current?.focus({preventScroll: true}); }, [compose, target]);
  const name = post.authorName ?? post.authorUsername ?? 'Member';
  const destination = `/community/post/${post.id}`;

  return (
    <article data-feed-post-id={post.id} className={compact ? 'timeline-spark timeline-spark-compact' : 'timeline-spark'}>
      <div className="spark-heading">
        <SparkByline author={post} createdAt={post.createdAt} stacked={compact} />
      </div>
      {(post.forumPost || post.type !== 'spark') && post.categorySlug && <Link className="forum-tag" to={'/community/' + post.categorySlug}>{post.categoryName}</Link>}
      <Link to={destination} className="spark-text">
        {post.title}
      </Link>
      {!post.sparkMedia?.length && post.imageUrl && /^https:\/\//i.test(post.imageUrl) && (
          <Link to={destination} aria-label="Open photo Post"><img src={post.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="mt-2 aspect-video w-full rounded-lg object-cover" /></Link>
      )}
      {!post.forumPost && post.sparkTopic && <Link className="inline-flex min-h-8 items-center text-xs text-primary" to={topicPath(post.sparkTopic)}>{post.sparkTopic}</Link>}
      <SparkMediaGallery media={post.sparkMedia} />
      {post.sparkReading && <SparkReadingAttachment reading={post.sparkReading} postId={post.id} />}
      {post.reshareOf && <p className="text-xs text-muted-foreground">Reshared by {name}</p>}
      {post.originalSparkId && <OriginalSparkCard spark={post.originalSpark} />}
      {post.type !== 'spark' && post.preview && <div className="post-excerpt"><CommunityPostBody html={post.preview} /></div>}
      <SparkActions post={{...post, replyCount: (post.replyCount ?? 0) + extra}} onReply={!post.isLocked ? () => reply(null) : undefined} cardAuthor={name} compact={compact} canInteract={canInteract} onFavorite={onFavorite} onSave={onSave} />
      {!!post.replyPreviews?.length && <div className="feed-replies">{post.replyPreviews.map(r => <div key={r.id}>
        <Link to={sparkReplyPath(post.id,r.id)}><strong>{r.username ? '@' + r.username : r.name}</strong></Link>
        <div className="post-excerpt"><CommunityPostBody html={r.body}/></div>
        {r.gifUrl && <img src={r.gifUrl} alt="GIF reply" className="reply-preview-gif" loading="lazy" />}
        {canInteract && !post.isLocked && <button onClick={() => reply({id:r.id, authorName:r.name,authorUsername:r.username})}>Reply</button>}
      </div>)}</div>}
      {compose && <section className="inline-reply"><button className="reply-close" onClick={() => setCompose(false)} aria-label="Close reply">×</button>
        <ReplyComposer postId={post.id} replyTo={target} sparkAuthor={post.authorUsername ? '@'+post.authorUsername : name}
          fieldRef={field} canFollowUp={false} isLocked={post.isLocked} onClear={() => setTarget(null)}
          onSubmitted={id => {setExtra(n => n+1);setSent(id ?? null);setCompose(false);}} />
      </section>}
      {sent && <Link className="sent-reply" to={sparkReplyPath(post.id,sent)}>Reply posted · View in thread</Link>}
    </article>
  );
}
