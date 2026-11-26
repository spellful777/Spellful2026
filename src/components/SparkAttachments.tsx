import { Image, RotateCcw, Video, X } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useEffect, useRef, useState } from 'react';
import { sparkMediaPath, type SparkMediaKind, type SparkMediaLimits } from '@/lib/spark-media';

type Upload = {
  id: string;
  file: File;
  kind: SparkMediaKind;
  state: 'queued' | 'uploading' | 'processing' | 'ready' | 'failed';
  progress: number;
  error?: string;
  duration?: number;
};
const photoTypes = ['image/jpeg', 'image/png', 'image/webp'];
const videoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

export function useSparkAttachments(enabled: boolean) {
  const [limits, setLimits] = useState<(SparkMediaLimits & { enabled: boolean }) | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [error, setError] = useState('');
  const [replacement, setReplacement] = useState<Upload[] | null>(null);
  const [busy, setBusy] = useState(false);
  const removing = useRef(false);
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
    if (!next || active.current || removing.current || !enabled) return;
    const request = new XMLHttpRequest();
    active.current = { id: next.id, request };
    const finish = (patch: Partial<Upload>) => {
      if (active.current?.request !== request) return;
      active.current = null;
      update(next.id, patch);
    };
    request.open('PUT', sparkMediaPath(next.id) + '?kind=' + next.kind);
    request.responseType = 'json';
    request.withCredentials = true;
    request.setRequestHeader('Content-Type', 'application/octet-stream');
    request.upload.onprogress = event => {
      if (event.lengthComputable) update(next.id, { progress: Math.round(event.loaded * 100 / event.total) });
    };
    request.upload.onload = () => update(next.id, { state: 'processing', progress: 100 });
    request.onload = () => finish(request.status === 201
      ? { state: 'ready', progress: 100, duration: request.response?.duration }
      : { state: 'failed', error: request.response?.error ?? 'Upload failed. Try again.' });
    request.onerror = () => finish({ state: 'failed', error: 'Connection lost. Try again.' });
    request.timeout = 310000;
    request.ontimeout = () => finish({ state: 'failed', error: 'Upload timed out. Try again.' });
    update(next.id, { state: 'uploading' });
    request.send(next.file);
  }, [uploads, busy, enabled]);

  function select(files: FileList | null, kind: SparkMediaKind) {
    if (removing.current || !limits?.enabled || !files?.length) return;
    setError('');
    const selected: Upload[] = [];
    for (const file of files) {
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
    const switching = uploads.some(upload => upload.kind !== kind);
    const all = switching ? selected : [...uploads, ...selected];
    if (all.some(file => file.kind === 'video') ? all.length !== 1 : all.length > limits.photos) {
      setError('Choose up to ' + limits.photos + ' photos or one video.');
      return;
    }
    if (switching) setReplacement(selected);
    else setUploads(all);
  }

  async function discard(removed: Upload[], added: Upload[] = []) {
    if (removing.current) return;
    removing.current = true;
    setBusy(true);
    const ids = new Set(removed.map(upload => upload.id));
    const running = active.current;
    if (running && ids.has(running.id)) {
      active.current = null;
      running.request.abort();
    }
    setUploads(items => items.filter(item => !ids.has(item.id)));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    try {
      await Promise.all(removed.filter(upload => upload.state !== 'queued' || upload.id === running?.id)
        .map(upload => fetch(sparkMediaPath(upload.id), { method: 'DELETE', credentials: 'include', signal: controller.signal })
          .catch(() => {})));
      setUploads(items => [...items, ...added]);
    } finally {
      window.clearTimeout(timeout);
      removing.current = false;
      setBusy(false);
    }
  }

  function confirmReplacement() {
    if (!replacement) return;
    const next = replacement;
    setReplacement(null);
    void discard(uploads, next);
  }

  const retry = (upload: Upload) => {
    void fetch(sparkMediaPath(upload.id), { method: 'DELETE', credentials: 'include' }).catch(() => {});
    update(upload.id, { id: crypto.randomUUID(), state: 'queued', progress: 0, error: undefined });
  };
  return {
    limits, uploads, error, select, discard, retry, busy,
    replacement, confirmReplacement, cancelReplacement: () => setReplacement(null),
  };
}

function AttachmentThumbnail({ upload, disabled, onRemove, onRetry }: {
  upload: Upload;
  disabled: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    if (upload.kind !== 'photo') return;
    const url = URL.createObjectURL(upload.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [upload.file, upload.kind]);

  const source = upload.kind === 'photo' ? preview
    : upload.state === 'ready' ? sparkMediaPath(upload.id, true) + '?draft=1' : '';
  const duration = upload.duration ? Math.ceil(upload.duration) : null;
  return (
    <div className="spark-draft-thumbnail">
      {source ? <img src={source} alt={upload.kind === 'video' ? 'Video poster' : upload.file.name} />
        : <Video className="size-6" aria-hidden="true" />}
      <button type="button" className="spark-draft-remove" disabled={disabled} onClick={onRemove}
        aria-label={(upload.state === 'ready' || upload.state === 'failed' ? 'Remove ' : 'Cancel upload of ') + upload.file.name}>
        <X className="size-4" aria-hidden="true" />
      </button>
      {upload.state === 'ready' && duration !== null && <span className="spark-draft-overlay">0:{String(duration).padStart(2, '0')}</span>}
      {upload.state === 'queued' && <span className="spark-draft-overlay">Queued</span>}
      {upload.state === 'processing' && <span className="spark-draft-overlay" role="status">Processing…</span>}
      {upload.state === 'uploading' && <span className="spark-draft-overlay">
        {upload.progress}%<progress aria-label={'Uploading ' + upload.file.name} max={100} value={upload.progress} />
      </span>}
      {upload.state === 'failed' && <button type="button" className="spark-draft-retry" disabled={disabled} onClick={onRetry}
        aria-label={'Retry ' + upload.file.name}><RotateCcw className="size-3" aria-hidden="true" /> Retry</button>}
    </div>
  );
}

export function SparkAttachments({ attachments, disabled }: {
  attachments: ReturnType<typeof useSparkAttachments>;
  disabled: boolean;
}) {
  const { limits, uploads, error, select, discard, retry, busy, replacement, confirmReplacement, cancelReplacement } = attachments;
  const photos = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLInputElement>(null);
  const kind = uploads[0]?.kind;
  const unavailable = disabled || busy || !limits?.enabled;
  const mb = 1024 * 1024;
  return <section className="spark-draft-media" aria-label="Spark attachments">
    {uploads.length > 0 && <div className="spark-draft-preview">
      <div className="spark-draft-thumbnails" data-single={uploads.length === 1}>
        {uploads.map(upload => <AttachmentThumbnail key={upload.id} upload={upload} disabled={disabled || busy}
          onRemove={() => void discard([upload])} onRetry={() => retry(upload)} />)}
      </div>
      {kind === 'photo' && <span className="spark-draft-count">{uploads.length} / {limits?.photos} photos</span>}
    </div>}
    <div className="spark-draft-media-buttons">
      <button type="button" disabled={unavailable || (kind === 'photo' && uploads.length === limits?.photos)}
        data-selected={kind === 'photo'} aria-describedby="spark-media-limits spark-photo-size" onClick={() => photos.current?.click()}>
        <Image className="size-5" aria-hidden="true" /> Photos
      </button>
      <button type="button" disabled={unavailable || kind === 'video'} data-selected={kind === 'video'}
        aria-describedby="spark-media-limits spark-video-size" onClick={() => video.current?.click()}>
        <Video className="size-5" aria-hidden="true" /> Video
      </button>
      <input type="file" hidden ref={photos} multiple accept={photoTypes.join(',')}
        onChange={event => { select(event.currentTarget.files, 'photo'); event.currentTarget.value = ''; }} />
      <input type="file" hidden ref={video} accept={videoTypes.join(',')}
        onChange={event => { select(event.currentTarget.files, 'video'); event.currentTarget.value = ''; }} />
    </div>
    <p id="spark-media-limits">{limits
      ? 'Up to ' + limits.photos + ' photos or 1 video · ' + limits.videoSeconds + 's max'
      : error ? 'Attachment limits unavailable.' : 'Loading attachment limits…'}</p>
    {limits && <>
      <span id="spark-photo-size" className="sr-only">Up to {limits.photoBytes / mb} MB per photo.</span>
      <span id="spark-video-size" className="sr-only">Up to {limits.videoBytes / mb} MB per video.</span>
    </>}
    {limits && !limits.enabled && <p>Uploads are currently unavailable.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {uploads.filter(upload => upload.error).map(upload =>
      <p key={upload.id} role="alert" className="text-destructive">{upload.file.name}: {upload.error}</p>)}
    <AlertDialog open={!!replacement} onOpenChange={open => { if (!open) cancelReplacement(); }}>
      <AlertDialogContent>
        <AlertDialogTitle>Replace attachments?</AlertDialogTitle>
        <AlertDialogDescription>
          {kind === 'photo' ? 'Adding a video will replace your photos.' : 'Adding photos will replace your video.'}
          {' Your Spark text will stay in the draft.'}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep current media</AlertDialogCancel>
          <AlertDialogAction onClick={confirmReplacement}>Replace</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>;
}
