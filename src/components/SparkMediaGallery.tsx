import { SparkReadingAttachment } from '@/components/SparkReadingAttachment';
import { useState } from 'react';
import { Link } from 'react-router';
import { Play } from 'lucide-react';
import { sparkMediaPath, type OriginalSpark, type SparkMedia } from '@/lib/spark-media';

function SparkVideo({ id }: { id: string }) {
  const [playing, setPlaying] = useState(false);
  const poster = sparkMediaPath(id, true);
  if (playing) return <video autoPlay controls playsInline preload="metadata" poster={poster} src={sparkMediaPath(id)} className="max-h-96 w-full rounded-lg bg-black" />;
  return (
    <button type="button" aria-label="Play Spark video" onClick={() => setPlaying(true)} className="relative block w-full rounded-lg bg-black focus-visible:outline focus-visible:outline-primary">
      <img src={poster} loading="lazy" alt="" className="aspect-video w-full rounded-lg object-contain" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="grid size-12 place-items-center rounded-full bg-black/75 text-white"><Play aria-hidden="true" className="size-5 fill-current" /></span>
      </span>
    </button>
  );
}

export function SparkMediaGallery({ media }: { media?: SparkMedia[] | null }) {
  if (!media?.length) return null;
  if (media[0].kind === 'video') return <div className="mt-2"><SparkVideo key={media[0].id} id={media[0].id} /></div>;
  return <div className={`mt-2 grid gap-1.5 ${media.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
    {media.map(({ id }, index) => <a key={id} href={sparkMediaPath(id)} target="_blank" rel="noopener noreferrer"
      aria-label={`Open Spark photo ${index + 1}`} className="block overflow-hidden rounded-lg bg-black/20">
      <img src={sparkMediaPath(id)} alt="" loading="lazy" className="aspect-video w-full object-cover" />
    </a>)}
  </div>;
}

export function OriginalSparkCard({ spark }: { spark?: OriginalSpark | null }) {
  if (!spark) return <p className="mt-2 text-sm text-muted-foreground">Original Spark unavailable.</p>;
  return <div className="mt-2 rounded-lg border border-border p-2">
    <Link to={`/community/post/${spark.id}`} className="block break-words text-sm hover:underline">
      <span className="font-semibold">{spark.authorName ?? 'Spellful member'}</span>
      {spark.title && <span className="mt-1 block">{spark.title}</span>}
      <span className="mt-1 block text-xs text-muted-foreground">View original Spark</span>
    </Link>
    <SparkMediaGallery media={spark.sparkMedia} />
    {spark.sparkReading && <SparkReadingAttachment reading={spark.sparkReading} postId={spark.id} />}
    {spark.imageUrl && !spark.sparkMedia?.length && /^https:\/\//i.test(spark.imageUrl) &&
      <img src={spark.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="mt-2 aspect-video w-full rounded-lg object-cover" />}
  </div>;
}
