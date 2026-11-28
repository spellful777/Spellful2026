import { Link } from 'react-router';
import { uploadedMediaUrl } from '@/lib/native-api';

type Author = {
  authorName: string | null;
  authorUsername: string | null;
  authorImage: string | null;
  createdAt: string;
};

function shortAge(date: Date) {
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return minutes + 'm';
  if (minutes < 1440) return Math.floor(minutes / 60) + 'h';
  if (minutes < 10080) return Math.floor(minutes / 1440) + 'd';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}

export function SparkThreadAuthor({ author, edited }: { author: Author; edited?: boolean }) {
  const name = author.authorName || author.authorUsername || 'Member';
  const date = new Date(author.createdAt);
  const identity = <>
    <span aria-hidden="true" className="spark-thread-avatar">
      {author.authorImage ? <img src={uploadedMediaUrl(author.authorImage)} alt="" /> : name.charAt(0).toUpperCase()}
    </span>
    <strong>{name}</strong>
    {author.authorUsername && <span className="spark-thread-handle">@{author.authorUsername}</span>}
  </>;
  return <div className="spark-thread-byline">
    {author.authorUsername
      ? <Link className="spark-thread-identity" to={'/u/' + encodeURIComponent(author.authorUsername)}>{identity}</Link>
      : <span className="spark-thread-identity">{identity}</span>}
    <span aria-hidden="true">·</span>
    <time dateTime={author.createdAt} title={date.toLocaleString()}>{shortAge(date)}</time>
    {edited && <span>· edited</span>}
  </div>;
}
