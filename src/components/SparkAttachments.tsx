import { useEffect, useRef, useState } from 'react';
import { sparkMediaPath, type SparkMediaKind, type SparkMediaLimits } from '@/lib/spark-media';

type Upload = {
  id: string;
  file: File;
  kind: SparkMediaKind;
  state: 'queued' | 'uploading' | 'processing' | 'ready' | 'failed';
  progress: number;
  error?: string;
};
const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];
const videoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

export function useSparkAttachments(enabled: boolean) {
  const [limits, setLimits] = useState<(SparkMediaLimits & { enabled: boolean }) | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState('');
  const active = useRef<{ id: string; request: XMLHttpRequest } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const abort = new AbortController();
    fetch('/api/community/spark-media/config', { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error();
        return response.json();
      }).then(setLimits).catch(() => {
        if (!abort.signal.aborted) setError('Couldn’t load upload limits.');
      });
    return () => abort.abort();
  }, [enabled]);

  useEffect(() => () => {
    const request = active.current?.request;
    active.current = null;
    request?.abort();
  }, []);

  const update = (id: string, patch: Partial<Upload>) =>
    setUploads(items => items.map(item => item.id === id ? { ...item, ...patch } : item));

  useEffect(() => {
    const next = uploads.find(upload => upload.state === 'queued');
    if (!next || active.current) return;
    const request = new XMLHttpRequest();
    active.current = { id: next.id, request };
    const finish = (patch: Partial<Upload>) => {
      if (active.current?.request !== request) return;
      active.current = null;
      update(next.id, patch);
    };
    request.open('PUT', sparkMediaPath(next.id) + '?kind=' + next.kind);
    request.responseType = 'json';
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.upload.onprogress = event => {
      if (event.lengthComputable) update(next.id, { progress: Math.round(event.loaded * 100 / event.total) });
    };
    request.upload.onload = () => update(next.id, { state: 'processing', progress: 100 });
    request.onload = () => finish(request.status === 201
      ? { state: 'ready', progress: 100 }
      : { state: 'failed', error: request.response?.error ?? 'Upload failed. Try again.' });
    request.onerror = () => finish({ state: 'failed', error: 'Connection lost. Try again.' });
    request.timeout = 310000;
    request.ontimeout = () => finish({ state: 'failed', error: 'Upload timed out. Try again.' });
    update(next.id, { state: 'uploading' });
    request.send(next.file);
  }, [uploads]);

  function select(files: FileList | null) {
    if (!limits?.enabled || !files?.length) return;
    setError('');
    const selected: Upload[] = [];
    for (const file of files) {
      const kind = file.type.startsWith('video/') ? 'video' : 'photo';
      if (!(kind === 'video' ? videoTypes : photoTypes).includes(file.type)) {
        setError('Choose JPEG, PNG, WebP, MP4, MOV, or WebM files.');
        return;
      }
      if (!file.size || file.size > (kind === 'video' ? limits.videoBytes : limits.photoBytes)) {
        setError(file.name + ' is empty or exceeds the size limit.');
        return;
      }
      selected.push({ id: crypto.randomUUID(), file, kind, state: 'queued', progress: 0 });
    }
    const all = [...uploads, ...selected];
    if (all.some(file => file.kind === 'video') ? all.length !== 1 : all.length > limits.photos) {
      setError('Choose up to ' + limits.photos + ' photos or one video.');
      return;
    }
    setUploads(all);
  }

  async function remove(upload: Upload) {
    if (active.current?.id === upload.id) {
      const { request } = active.current;
      active.current = null;
      request.abort();
    }
    setUploads(items => items.filter(item => item.id !== upload.id));
    if (upload.state !== 'queued') await fetch(sparkMediaPath(upload.id), { method: 'DELETE' }).catch(() => {});
  }

  const retry = (upload: Upload) => {
    void fetch(sparkMediaPath(upload.id), { method: 'DELETE' }).catch(() => {});
    update(upload.id, { id: crypto.randomUUID(), state: 'queued', progress: 0, error: undefined });
  };
  return { limits, uploads, error, select, remove, retry };
}

export function SparkAttachments({ attachments, disabled }: {
  attachments: ReturnType<typeof useSparkAttachments>;
  disabled: boolean;
}) {
  const { limits, uploads, error, select, remove, retry } = attachments;
  const mb = 1024 * 1024;
  return <section className="space-y-2 text-sm" aria-label="Spark attachments">
    <p id="spark-media-limits" className="text-muted-foreground">{limits
      ? 'Up to ' + limits.photos + ' photos (' + limits.photoBytes / mb + ' MB each) or one video (' + limits.videoBytes / mb + ' MB, ' + limits.videoSeconds + ' seconds max).'
      : error ? 'Attachment limits unavailable.' : 'Loading attachment limits…'}</p>
    {limits?.enabled && <label className="block">
      <span className="sr-only">Add photos or video</span>
      <input type="file" multiple accept={[...photoTypes, ...videoTypes].join(',')} aria-describedby="spark-media-limits" disabled={disabled}
        className="block min-h-11 w-full rounded-lg border border-border p-2 file:mr-2 file:border-0 file:bg-transparent file:font-semibold file:text-primary"
        onChange={event => { select(event.currentTarget.files); event.currentTarget.value = ''; }} />
    </label>}
    {limits && !limits.enabled && <p className="text-muted-foreground">Uploads are currently unavailable.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {uploads.map(upload => <div key={upload.id} className="flex items-center gap-2 rounded border border-border px-2">
      <div className="min-w-0 flex-1 py-1">
        <p className="truncate">{upload.file.name}</p>
        {upload.state === 'uploading' && <progress aria-label={'Uploading ' + upload.file.name} value={upload.progress} max={100} className="w-full" />}
        {upload.state !== 'uploading' && <p role="status" className={upload.error ? 'text-xs text-destructive' : 'text-xs text-muted-foreground'}>
          {upload.error ?? { queued: 'Waiting to upload', processing: 'Processing…', ready: 'Ready', failed: 'Upload failed' }[upload.state]}
        </p>}
      </div>
      {upload.state === 'failed' && <button type="button" className="min-h-11 px-1 text-primary" onClick={() => retry(upload)} disabled={disabled}>Retry</button>}
      <button type="button" className="min-h-11 px-1" disabled={disabled} onClick={() => void remove(upload)}>
        {['queued', 'uploading', 'processing'].includes(upload.state) ? 'Cancel' : 'Remove'}
      </button>
    </div>)}
  </section>;
}
