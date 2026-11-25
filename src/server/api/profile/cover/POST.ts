import type { Request, Response } from 'express';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { getEntitlement } from '@/server/lib/plus-entitlement.js';
import busboy from 'busboy';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = '/shared-storage/public/assets/uploads/covers';
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']);

export default async function handler(req: Request, res: Response) {
  try {
    if (!db) return res.status(503).json({ error: 'Database unavailable' });
    const session = await getAuthSession(req);
    if (!session?.user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const userId = session.user.id;

    // Custom cover photo upload is a Spellful Plus feature
    const ent = await getEntitlement(userId);
    if (!ent.isPlus) {
      return res.status(403).json({ error: 'Custom cover photo requires Spellful Plus.', code: 'PLUS_REQUIRED' });
    }

    await fs.promises.mkdir(UPLOAD_DIR, { recursive: true });

    // Wrap the entire busboy flow in a Promise so we can await it before responding.
    // This prevents finish / write-stream-close races from sending "No file received".
    const result = await new Promise<{ url: string } | { error: string; status: number }>((resolve) => {
      const bb = busboy({ headers: req.headers, limits: { fileSize: MAX_SIZE, files: 1 } });
      let fileHandled = false;

      bb.on('file', (_field, file, info) => {
        fileHandled = true;
        const { mimeType } = info;

        if (!ALLOWED.has(mimeType)) {
          (file as NodeJS.ReadableStream & { resume(): void }).resume();
          resolve({ error: 'Invalid file type. Use JPEG, PNG, WebP, GIF, HEIC, or HEIF.', status: 400 });
          return;
        }

        const rawExt = mimeType.split('/')[1];
        const ext = rawExt === 'jpeg' ? 'jpg' : (rawExt === 'heic' || rawExt === 'heif') ? 'jpg' : rawExt;
        const safeExt = ext.replace(/[^a-z0-9]/g, '');
        const safeUserId = userId.replace(/[^a-zA-Z0-9]/g, '');
        const filename = `cover-${safeUserId}-${Date.now()}.${safeExt}`;
        const filepath = path.resolve(UPLOAD_DIR, filename);

        if (!filepath.startsWith(UPLOAD_DIR + path.sep) && filepath !== UPLOAD_DIR) {
          (file as NodeJS.ReadableStream & { resume(): void }).resume();
          resolve({ error: 'Invalid file path', status: 400 });
          return;
        }

        let sizeError = false;
        file.on('limit', () => {
          sizeError = true;
          fs.unlink(filepath, () => undefined);
          resolve({ error: 'File too large (max 5 MB)', status: 413 });
        });

        const ws = fs.createWriteStream(filepath);
        file.pipe(ws);

        // Wait for the write stream to fully close before resolving —
        // this is the key fix: we don't resolve until the file is on disk.
        ws.on('close', () => {
          if (sizeError) return;
          resolve({ url: `/airo-assets/uploads/covers/${filename}` });
        });

        ws.on('error', (err) => {
          resolve({ error: String(err), status: 500 });
        });
      });

      bb.on('finish', () => {
        if (!fileHandled) {
          resolve({ error: 'No file received', status: 400 });
        }
        // If fileHandled, the ws 'close' event resolves — don't double-resolve here.
      });

      bb.on('error', (err: Error) => {
        resolve({ error: err.message, status: 500 });
      });

      req.pipe(bb);
    });

    if ('url' in result) {
      await db.update(user).set({ coverImage: result.url }).where(eq(user.id, userId));
      res.json({ ok: true, url: result.url });
    } else {
      res.status(result.status).json({ error: result.error });
    }
  } catch (err) {
    console.error(JSON.stringify({ event: 'profile.cover.error', msg: String(err).slice(0, 120) }));
    if (!res.headersSent) res.status(500).json({ error: 'Upload failed' });
  }
}
