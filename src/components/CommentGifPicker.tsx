import { useState, type FormEvent } from 'react';
import { CANDLELIGHT_GIF, commentGifUrl } from '@/lib/spark-comments';

type Gif = { url: string; title: string };
export function CommentGifPicker({ onPick }: { onPick: (url: string) => void }) {
  const key = import.meta.env.VITE_GIPHY_API_KEY;
  const [query, setQuery] = useState('');
  const [link, setLink] = useState('');
  const [results, setResults] = useState<Gif[]>([]);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!key || !query.trim() || loading) return;
    setLoading(true);
    setStatus('');
    try {
      const params = new URLSearchParams({ api_key: key, q: query, rating: 'pg', limit: '12' });
      const response = await fetch('https://api.giphy.com/v1/gifs/search?' + params);
      if (!response.ok) throw Error();
      const body = await response.json() as { data: { title: string; images?: { fixed_width?: { url: string } } }[] };
      const found = body.data.flatMap(item => {
        const url = commentGifUrl(item.images?.fixed_width?.url);
        return url ? [{ url, title: item.title || 'GIF' }] : [];
      });
      setResults(found);
      if (!found.length) setStatus('No GIFs found.');
    } catch { setStatus('GIF search is unavailable. You can paste a GIF link below.'); }
    finally { setLoading(false); }
  }

  const valid = commentGifUrl(link);
  return <div className="space-y-2 pb-2">
    <button type="button" aria-label="Attach candlelight GIF" onClick={() => onPick(CANDLELIGHT_GIF)}><img src={CANDLELIGHT_GIF} alt="Candlelight" width={96} height={54} className="rounded" /></button>
    {key && <>
      <form onSubmit={search} className="flex gap-2">
        <input aria-label="Search GIFs" className="min-w-0 flex-1 rounded border border-border bg-background px-2" maxLength={60}
          value={query} onChange={event => setQuery(event.target.value)} placeholder="Search GIFs" />
        <button className="min-h-11 px-2 text-sm text-primary" disabled={loading}>Search</button>
      </form>
      <p className="text-xs text-muted-foreground">Powered by GIPHY</p>
      {loading && <p role="status" className="text-xs">Searching…</p>}
      {status && <p role="status" className="text-xs">{status}</p>}
      {!!results.length && <div className="grid max-h-44 grid-cols-3 gap-1 overflow-y-auto">
        {results.map(gif => <button type="button" key={gif.url} aria-label={'Attach ' + gif.title} onClick={() => onPick(gif.url)}>
          <img alt="" src={gif.url} className="aspect-square w-full rounded object-cover" loading="lazy" referrerPolicy="no-referrer" />
        </button>)}
      </div>}
    </>}
    <div className="flex flex-wrap gap-2">
      <input aria-label="GIF link" className="min-w-0 flex-1 rounded border border-border bg-background px-2"
        placeholder="Paste a GIPHY or Tenor link" value={link} onChange={event => setLink(event.target.value)} />
      <button type="button" className="min-h-11 px-2 text-sm text-primary disabled:opacity-50" disabled={!valid}
        onClick={() => { if (valid) onPick(valid); }}>Attach GIF</button>
    </div>
  </div>;
}
