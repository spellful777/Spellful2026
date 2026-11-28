import type { Request, Response } from 'express';
import { getAuthSession } from '@/server/lib/auth-session.js';
import { db } from '@/server/db/client.js';
import { user } from '@/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getEntitlement } from '@/server/lib/plus-entitlement.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

export default async function handler(req: Request, res: Response): Promise<void> {
  const session = await getAuthSession(req);
  if (!session) { res.status(401).json({ error: 'Unauthorized' }); return; }

  // Custom avatar upload is a Spellful Plus feature
  const ent = await getEntitlement(session.user.id);
  if (!ent.isPlus) {
    res.status(403).json({ error: 'Custom avatar upload requires Spellful Plus.', code: 'PLUS_REQUIRED' });
    return;
  }

  const contentType = req.headers['content-type'] ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    res.status(400).json({ error: 'Expected multipart/form-data' });
    return;
  }

  try {
    const busboy = (await import('busboy')).default;
    const bb = busboy({ headers: req.headers as Record<string, string | string[]>, limits: { fileSize: MAX_SIZE, files: 1 } });

    // Wrap the entire busboy flow in a Promise so we can await it before responding.
    // This prevents the finish event racing ahead of the async file-write callback.
    const result = await new Promise<{ url: string } | { error: string; status: number }>((resolve) => {
      let fileHandled = false;

      bb.on('file', (_field: string, file: NodeJS.ReadableStream, info: { mimeType: string }) => {
        fileHandled = true;
        const { mimeType } = info;

        if (!ALLOWED_TYPES.includes(mimeType)) {
          // Drain the stream so busboy can finish cleanly
          (file as NodeJS.ReadableStream & { resume(): void }).resume();
          resolve({ error: 'Invalid file type. Use JPEG, PNG, WebP, GIF, HEIC, or HEIF.', status: 400 });
          return;
        }

        const chunks: Buffer[] = [];
        let limitHit = false;

        file.on('data', (chunk: Buffer) => chunks.push(chunk))
          .on('limit', () => {
            limitHit = true;
            resolve({ error: 'File too large. Maximum 5 MB.', status: 413 });
          })
          .on('end', () => {
            if (limitHit) return;
            // Kick off async work — resolve() is called inside so finish event
            // cannot race ahead and send "No file received".
            void (async () => {
              try {
                const buffer = Buffer.concat(chunks);
                const ext = mimeType === 'image/jpeg' ? '.jpg'
                  : mimeType === 'image/png' ? '.png'
                  : mimeType === 'image/webp' ? '.webp'
                  : (mimeType === 'image/heic' || mimeType === 'image/heif') ? '.jpg'
                  : '.gif';
                const filename = randomUUID() + ext;
                const uploadDir = '/shared-storage/public/assets/uploads/avatars';
                await mkdir(uploadDir, { recursive: true });
                // eslint-disable-next-line security/detect-non-literal-fs-filename
                await writeFile(join(uploadDir, filename), buffer); // safe: filename is a UUID
                const url = '/airo-assets/uploads/avatars/' + filename;
                await db!.update(user).set({ image: url, avatarPreset: '' }).where(eq(user.id, session.user.id));
                resolve({ url });
              } catch (writeErr) {
                resolve({ error: String(writeErr), status: 500 });
              }
            })();
          });
      });

      bb.on('finish', () => {
        // Only fires after all file events have emitted — but async work may
        // still be in flight. We only use this as a fallback for the no-file case.
        if (!fileHandled) {
          resolve({ error: 'No file received', status: 400 });
        }
      });

      bb.on('error', (err: Error) => {
        resolve({ error: err.message, status: 500 });
      });

      req.pipe(bb);
    });

    if ('url' in result) {
      res.json({ url: result.url });
    } else {
      res.status(result.status).json({ error: result.error });
    }
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: String(err) });
  }
}
