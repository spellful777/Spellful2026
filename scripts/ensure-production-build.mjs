import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

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
    execFileSync('npm', ['ci', '--omit=dev', '--prefer-offline', '--no-audit', '--no-fund'], {
      stdio: 'inherit',
    });
  }
  const { build } = await import('vite');
  if (needsClient) {
    console.info('Building missing Spellful client files');
    await build();
  }
  if (needsServer) {
    console.info('Building missing Spellful server bundle');
    await build({ build: { ssr: 'src/server/entry.ts' } });
  }
}
