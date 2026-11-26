import { createWriteStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join, resolve, isAbsolute } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { Request, Response } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { isSparkMediaId, type SparkMediaKind } from '@/lib/spark-media';
import { db } from '@/server/db/client.js';
import { communityPosts, sparkMediaUploads } from '@/server/db/schema.js';
import { getAuthSession } from './auth-session.js';
import { processSparkMedia, sparkMediaFilename, InvalidMedia } from './spark-media-processing.js';
import { postAudienceAllows } from './community-post-access.js';

const setting = (key: string, fallback: number, ceiling: number) => {
  const value = Number(process.env[key]);
  return Number.isSafeInteger(value) && value >= 1 && value <= ceiling ? value : fallback;
};
const MB = 1024 * 1024;
const limits = {
  photos: setting('SPARK_MEDIA_PHOTOS', 4, 4),
  photoBytes: setting('SPARK_MEDIA_PHOTO_MB', 10, 10) * MB,
  videoBytes: setting('SPARK_MEDIA_VIDEO_MB', 50, 50) * MB,
  videoSeconds: setting('SPARK_MEDIA_VIDEO_SECONDS', 30, 30),
};
const storage = () => {
  const directory = process.env.SPARK_MEDIA_DIR;
  return directory && isAbsolute(directory) ? resolve(directory) : null;
};
const active = new Map<string, { viewer: string; abort: AbortController; stopped: Promise<void> }>();
const uploadLifetime = setting('SPARK_MEDIA_DRAFT_HOURS', 24, 168) * 3600000;

export function sparkMediaConfig(_req: Request, res: Response) {
  res.json({ ...limits, enabled: !!storage() });
}

export const maxSparkPhotos = limits.photos;

export function fitsSparkMedia(kinds: SparkMediaKind[]) {
  return kinds.every(kind => kind === 'photo') ? kinds.length <= limits.photos
    : kinds.length === 1 && kinds[0] === 'video';
}

export async function uploadSparkMedia(req: Request, res: Response) {
  const viewer = (await getAuthSession(req))?.user?.id;
  if (!viewer) return res.sendStatus(401);
  const root = storage();
  if (!root) return res.status(503).json({ error: 'Spark uploads are currently unavailable.' });
  const id = req.params.id;
  const kind = req.query.kind;
  if (!isSparkMediaId(id) || (kind !== 'photo' && kind !== 'video')) return res.sendStatus(400);
  if (!req.is('application/octet-stream')) return res.sendStatus(415);
  const maxBytes = kind === 'photo' ? limits.photoBytes : limits.videoBytes;
  const size = Number(req.get('content-length'));
  if (!Number.isSafeInteger(size) || size < 1) return res.sendStatus(411);
  if (size > maxBytes) return res.status(413).json({ error: 'This file exceeds the size limit.' });
  if (active.has(id)) return res.sendStatus(409);
  if (active.size >= 4 || [...active.values()].some(upload => upload.viewer === viewer)) {
    return res.status(429).json({ error: 'An upload is already processing. Try again in a moment.' });
  }

  const abort = new AbortController();
  let finish = () => {};
  const stopped = new Promise<void>(resolve => { finish = resolve; });
  active.set(id, { viewer, abort, stopped });
  const directory = join(root, id);
  const input = join(directory, 'original');
  let created = false;
  let ready = false;
  const cancel = () => { if (!res.writableEnded) abort.abort(); };
  res.on('close', cancel);
  const timeout = setTimeout(() => abort.abort(), 5 * 60 * 1000);
  try {
    await mkdir(root, { recursive: true, mode: 0o700 });
    await mkdir(directory, { mode: 0o700 });
    created = true;
    let received = 0;
    const count = new Transform({ transform(chunk: Buffer, _encoding, callback) {
      received += chunk.length;
      if (received > maxBytes) callback(new InvalidMedia('This file exceeds the size limit.'));
      else callback(null, chunk);
    } });
    await pipeline(req, count, createWriteStream(input, { flags: 'wx', mode: 0o600 }), { signal: abort.signal });
    if (received !== size) throw new InvalidMedia('The upload was incomplete.');
    const duration = await processSparkMedia(input, directory, kind, abort.signal, limits.videoSeconds);
    await rm(input);
    abort.signal.throwIfAborted();
    await db.insert(sparkMediaUploads).values({ id, userId: viewer, kind });
    ready = true;
    if (!abort.signal.aborted) return res.status(201).json({ id, kind, duration });
  } catch (error) {
    if (!res.destroyed && !abort.signal.aborted) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return res.sendStatus(409);
      return res.status(422).json({ error: error instanceof InvalidMedia ? error.message : 'Couldn’t process this file. Try a JPEG, PNG, WebP, MP4, MOV, or WebM file.' });
    }
  } finally {
    clearTimeout(timeout);
    res.off('close', cancel);
    try {
      if (created && (!ready || abort.signal.aborted)) {
        if (!ready) await rm(directory, { recursive: true, force: true }).catch(() => {});
        else {
          const [deleted] = await db.delete(sparkMediaUploads).where(and(eq(sparkMediaUploads.id, id), isNull(sparkMediaUploads.postId)));
          if (deleted.affectedRows) await rm(directory, { recursive: true, force: true }).catch(() => {});
        }
      }
    } finally {
      active.delete(id);
      finish();
    }
  }
}

export async function deleteSparkMedia(req: Request, res: Response) {
  const viewer = (await getAuthSession(req))?.user?.id;
  if (!viewer) return res.sendStatus(401);
  const root = storage();
  const id = req.params.id;
  if (!root || !isSparkMediaId(id)) return res.sendStatus(404);
  const running = active.get(id);
  if (running?.viewer === viewer) {
    running.abort.abort();
    await running.stopped;
  }
  const [result] = await db.delete(sparkMediaUploads).where(and(eq(sparkMediaUploads.id, id),
    eq(sparkMediaUploads.userId, viewer), isNull(sparkMediaUploads.postId)));
  if (result.affectedRows) await rm(join(root, id), { recursive: true, force: true });
  return res.sendStatus(204);
}

export async function readSparkMedia(req: Request, res: Response) {
  const root = storage();
  const id = req.params.id;
  if (!root || !isSparkMediaId(id)) return res.sendStatus(404);
  const viewer = (await getAuthSession(req))?.user?.id;
  const poster = req.path.endsWith('/poster');
  const query = db.select({ kind: sparkMediaUploads.kind }).from(sparkMediaUploads);
  const [attachment] = poster && req.query.draft === '1' && viewer
    ? await query.where(and(eq(sparkMediaUploads.id, id), eq(sparkMediaUploads.userId, viewer),
        isNull(sparkMediaUploads.postId))).limit(1)
    : await query.innerJoin(communityPosts, eq(communityPosts.id, sparkMediaUploads.postId))
    .where(and(eq(sparkMediaUploads.id, id), eq(communityPosts.isHidden, false), postAudienceAllows(viewer))).limit(1);
  if (!attachment) return res.sendStatus(404);
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  return res.sendFile(sparkMediaFilename(attachment.kind, poster), { root: join(root, id), cacheControl: false }, error => {
    if (error && !res.headersSent) res.sendStatus(404);
  });
}

async function cleanSparkMedia(root: string) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  for (const id of await readdir(root)) {
    if (!isSparkMediaId(id) || active.has(id)) continue;
    const directory = join(root, id);
    const details = await stat(directory).catch(() => null);
    if (!details || Date.now() - details.mtimeMs < uploadLifetime) continue;
    const removable = await db.transaction(async tx => {
      const [upload] = await tx.select({ postId: sparkMediaUploads.postId }).from(sparkMediaUploads)
        .where(eq(sparkMediaUploads.id, id)).limit(1).for('update');
      if (upload?.postId) return false;
      if (upload) await tx.delete(sparkMediaUploads).where(eq(sparkMediaUploads.id, id));
      return true;
    });
    if (removable) await rm(directory, { recursive: true, force: true });
  }
}

export function startSparkMediaCleanup() {
  const root = storage();
  if (!root) return;
  let running = false;
  const sweep = async () => {
    if (running) return;
    running = true;
    try { await cleanSparkMedia(root); }
    catch { console.error('spark.media.cleanup.failed'); }
    finally { running = false; }
  };
  void sweep();
  setInterval(sweep, 3600000).unref();
}
