import { useEffect, useState } from 'react';
import { commentUrl } from '@/lib/comment-links';

export function CommentLinkPreview({ text, onRemove }: { text: string; onRemove?: () => void }) {
  const url = commentUrl(text);
  const href = url?.href;
  const [resolved, setResolved] = useState<{ href: string; title: string; image?: string } | null>(null);
  useEffect(() => {
    if (!href) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      fetch('/api/community/comment-link-preview?' + new URLSearchParams({ url: href }), { signal: abort.signal })
        .then(result => result.ok ? result.json() : null)
        .then(metadata => { if (!abort.signal.aborted && metadata?.title) setResolved({ href, ...metadata }); })
        .catch(() => {});
    }, 400);
    return () => { window.clearTimeout(timer); abort.abort(); };
  }, [href]);

  if (!url) return null;
  const metadata = resolved?.href === href ? resolved : null;
  return <div className="flex min-w-0 items-center gap-2">
    <a href={href} target="_blank" rel="noopener noreferrer" className="spark-comment-link flex-1 items-center">
      {metadata?.image && <img alt="" src={metadata.image} className="size-9 rounded object-cover" loading="lazy" referrerPolicy="no-referrer" />}
      <div className="grid min-w-0">
        {metadata?.title && <span className="font-semibold">{metadata.title}</span>}
        <span>{url.hostname}</span>
      </div>
    </a>
    {onRemove && <button type="button" className="min-h-11 px-2 text-xs" onClick={onRemove}>Remove preview</button>}
  </div>;
}
