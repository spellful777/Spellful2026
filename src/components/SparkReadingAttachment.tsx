import { apiOrigin } from '@/lib/native-api';
import { projectTarot } from '@/lib/shared-reading';
import { natalWheelSvg, type SparkReading } from '@/lib/spark-reading';

export function SparkReadingAttachment({ reading, postId }: { reading: SparkReading; postId?: number }) {
  if (reading.type === 'numerology') return <figure className="number-reading">
    <figcaption>Numerology · {reading.label}</figcaption><strong>{reading.number}</strong></figure>;
  if (reading.type === 'horoscope') {
    return <figure className="my-2 min-w-0 rounded-lg border border-border bg-background/60 p-3" aria-label="Shared horoscope">
      <figcaption className="text-xs text-muted-foreground">
        {reading.sign} · <time dateTime={reading.date}>{reading.date}</time>
      </figcaption>
      <p className="my-1 break-words font-heading text-lg text-foreground">{reading.headline}</p>
      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{reading.body}</p>
    </figure>;
  }
  if (reading.type === 'natal') {
    const imageUrl = postId ? apiOrigin + '/api/community/posts/' + postId + '/chart.svg'
      : 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(natalWheelSvg(reading));
    return <figure className="my-2 rounded-lg border border-border bg-background/60 p-2 text-center">
      <figcaption className="text-sm font-medium">Natal chart wheel</figcaption>
      <img src={imageUrl} alt="Natal chart wheel showing zodiac signs, houses, and planet placements" className="mx-auto max-h-56 w-auto max-w-full" loading="lazy" />
      {postId && <a href={imageUrl} download="spellful-natal-wheel.svg" className="inline-flex min-h-9 items-center text-xs text-primary">Download wheel</a>}
    </figure>;
  }
  const cards = projectTarot(reading);
  if (!cards) return null;
  return <figure className="my-2 rounded-lg border border-border bg-background/60 p-2">
    <figcaption className="mb-2 text-sm font-medium">Tarot spread</figcaption>
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cards.map((card, index) => <li key={index} className="min-w-0 rounded border border-border p-2 text-xs">
        {card.image && <img src={card.image} alt="" loading="lazy" className={'mx-auto mb-1 h-24 w-auto max-w-full rounded object-contain ' + (card.reversed ? 'rotate-180' : '')} />}
        <strong className="block">{card.name}</strong>
        {card.position && <span className="block text-muted-foreground">{card.position}</span>}
        {card.reversed && <span className="block text-primary">Reversed</span>}
        {card.interpretation && <p className="mt-1 break-words">{card.interpretation}</p>}
      </li>)}
    </ol>
  </figure>;
}
