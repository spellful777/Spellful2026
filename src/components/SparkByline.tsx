import { shortSparkAge } from '@/components/SparkThreadAuthor';
import { Link } from 'react-router';
import AvatarWithFrame from '@/components/AvatarWithFrame';

export type SparkAuthor = {
  authorName: string | null;
  authorUsername: string | null;
  authorImage: string | null;
  authorFrame?: string | null;
  authorPreset?: string | null;
  userId?: string;
};

export function SparkByline({ author, createdAt }: { author: SparkAuthor; createdAt: string | null }) {
  const name = author.authorName || author.authorUsername || 'Member';
  const slug = author.authorUsername || (author.userId && '~' + author.userId);
  const date = createdAt ? new Date(createdAt) : null;
  const validDate = date && Number.isFinite(date.getTime());
  const identity = <>
    <AvatarWithFrame src={author.authorImage} avatarPreset={author.authorPreset ?? undefined}
      frameKey={author.authorFrame ?? ''} size={36} alt="" className="spark-byline-avatar" />
    <strong>{name}</strong>
    {author.authorUsername && <span className="spark-byline-handle">@{author.authorUsername}</span>}
  </>;
  return <div className="spark-byline">
    {slug ? <Link className="spark-byline-author" to={'/u/' + encodeURIComponent(slug)}>{identity}</Link>
      : <div className="spark-byline-author">{identity}</div>}
    {validDate && <time dateTime={date.toISOString()} title={date.toLocaleString()}>
      {shortSparkAge(date)}
    </time>}
  </div>;
}
