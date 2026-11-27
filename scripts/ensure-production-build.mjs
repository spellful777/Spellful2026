import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { restoreHostedBuild } from './hosted-build.mjs';

const fullBuild = process.argv.includes('--build');

// GoDaddy can promote the preview's client files without running the SSR build.
const needsClient = fullBuild || !existsSync('dist/client/index.html');
const needsServer = fullBuild || !existsSync('dist/server.bundle.mjs') || !existsSync('dist/bin');

if (needsClient || needsServer || process.env.NOMAD_TASK_DIR) {
  let hasVite = true;
  try {
    import.meta.resolve('vite');
  } catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    hasVite = false;
  }
  if ((!fullBuild || !hasVite || process.env.NOMAD_TASK_DIR) &&
      restoreHostedBuild({ complete: !needsClient && !needsServer })) process.exit(0);
  if (!needsClient && !needsServer) process.exit(0);

  // The preview archive can also contain node_modules from the previous revision.
  if (!hasVite) {
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
      ssr: fullBuild && !process.env.NOMAD_TASK_DIR ? {} : { external: Object.keys(dependencies) },
      build: { ssr: 'src/server/entry.ts' },
    });
  }
}
