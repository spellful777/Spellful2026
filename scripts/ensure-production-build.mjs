import { existsSync } from 'node:fs';

// GoDaddy can promote the preview's client files without running the SSR build.
const needsClient = !existsSync('dist/client/index.html');
const needsServer = !existsSync('dist/server.bundle.mjs') || !existsSync('dist/bin');

if (needsClient || needsServer) {
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
