// Capacitor's static asset server cannot execute the web server's media routes.
// Resolve asset references in the native copy, leaving the web build untouched.
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseSlotPath, resolveSlotTargetUrl } from '../export-plugins/media-slot-selection.js';

if (process.env.CAPACITOR_PLATFORM_NAME === 'ios') {
  const root = 'ios/App/App/public';
  const manifest = JSON.parse(await readFile(join(root, 'airo-media.json'), 'utf8'));
  const uploads = new Map();
  for (const subdir of ['assets', 'assets/media', 'assets/images', 'assets/uploads']) {
    for (const entry of await readdir(join(root, subdir), { withFileTypes: true })) {
      if (entry.isFile()) uploads.set('/airo-assets/uploads/' + entry.name, '/' + subdir + '/' + entry.name);
    }
  }

  function resolveNativeUrl(path) {
    if (uploads.has(path)) return uploads.get(path);
    for (const prefix of ['/airo-assets/images/', '/airo-assets/videos/']) {
      const slot = parseSlotPath(path, prefix);
      if (slot && manifest[slot.slotPath]) {
        const target = resolveSlotTargetUrl(manifest[slot.slotPath], slot.surfaceVariant, null);
        if (uploads.has(target)) return uploads.get(target);
        if (target.startsWith('https://')) return target;
      }
    }
    return 'https://spellful.com' + path;
  }

  // App chunks and HTML contain literal asset paths. A computed slot or user
  // upload uses the same HTTPS endpoint as the published site.
  const paths = ['index.html', ...((await readdir(join(root, 'assets'))).filter(name => /\.(js|css)$/.test(name)).map(name => 'assets/' + name))];
  for (const file of paths) {
    const absolute = join(root, file);
    const original = await readFile(absolute, 'utf8');
    const updated = original.replace(/(["'`(])(\/airo-assets\/(?:uploads|images|videos)\/[A-Za-z0-9_./%-]*)/g,
      (_, delimiter, path) => delimiter + resolveNativeUrl(path));
    if (updated !== original) await writeFile(absolute, updated);
  }
}
