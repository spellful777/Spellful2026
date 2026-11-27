import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// GoDaddy can promote the preview's client files without running the SSR build.
const needsClient = !existsSync('dist/client/index.html');
const needsServer = !existsSync('dist/server.bundle.mjs') || !existsSync('dist/bin');

if (needsClient || needsServer) {
  // The preview archive can also contain node_modules from the previous revision.
  try {
    import.meta.resolve('vite');
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    console.info('Installing locked production dependencies for the missing build');
    const cache = mkdtempSync(join(tmpdir(), 'spellful-npm-'));
    try {
      execFileSync('npm', ['ci', '--omit=dev', '--cache', cache, '--no-audit', '--no-fund'], {
        stdio: 'inherit',
      });
    } finally {
      rmSync(cache, { recursive: true, force: true });
    }
  }
  const { build } = await import('vite');
  if (needsClient) {
    console.info('Building missing Spellful client files');
    await build();
  }
  if (needsServer) {
    console.info('Building missing Spellful server bundle');
    // GoDaddy already installs these packages. Bundling their source at startup
    // exceeds the preview container's memory limit.
    const { dependencies } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    await build({
      ssr: { external: Object.keys(dependencies) },
      build: { ssr: 'src/server/entry.ts' },
    });
  }
}
