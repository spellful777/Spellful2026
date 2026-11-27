import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const archive = 'scripts/hosted-build/app.tar.gz';
const manifest = 'scripts/hosted-build/manifest.json';
const installed = 'dist/.spellful-hosted-build';

function filesIn(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? filesIn(path) : [path];
  });
}

const digest = data => createHash('sha256').update(data).digest('hex');

function inputHash() {
  const paths = ['package-lock.json', 'vite.config.ts', 'postcss.config.js', 'tailwind.config.js',
    'tsconfig.json', 'tsconfig.node.json', 'index.html', 'airo-media.json', ...filesIn('src'),
    ...filesIn('export-plugins')];
  const hash = createHash('sha256');
  for (const path of paths.sort()) hash.update(path + '\0' + digest(readFileSync(path)) + '\n');
  return hash.digest('hex');
}

export function restoreHostedBuild({ complete = false } = {}) {
  if (!existsSync(manifest) || !existsSync(archive)) return false;
  const release = JSON.parse(readFileSync(manifest, 'utf8'));
  if (release.inputs !== inputHash()) return false;
  if (complete && existsSync(installed) && readFileSync(installed, 'utf8') === release.sha256) return true;
  if (release.sha256 !== digest(readFileSync(archive))) throw Error('Invalid hosted build checksum');
  mkdirSync('dist/client', { recursive: true });
  cpSync('public', 'dist/client', { recursive: true });
  execFileSync('tar', ['-xzf', archive, '-C', 'dist']);
  writeFileSync(installed, release.sha256);
  console.info('Restored the compiled Spellful client and server');
  return true;
}

if (process.argv.includes('--pack-hosted-build')) {
  // Public media is already tracked and restored separately. Package only compiler output.
  const files = filesIn('dist').map(path => relative('dist', path)).filter(path =>
    path === 'server.bundle.mjs' || path.startsWith('bin/') ||
    (path.startsWith('client/') && !existsSync(join('public', relative('client', path))))
  ).sort();
  if (!files.includes('server.bundle.mjs') || !files.includes('client/index.html') ||
      !files.some(path => path.startsWith('bin/'))) throw Error('Incomplete production build');
  mkdirSync('scripts/hosted-build', { recursive: true });
  execFileSync('tar', ['--format=ustar', '--owner=0', '--group=0', '--mtime=1970-01-01',
    '-czf', archive, '-C', 'dist', '--null', '-T', '-'], { input: files.join('\0') + '\0' });
  writeFileSync(manifest, JSON.stringify({ inputs: inputHash(), sha256: digest(readFileSync(archive)) }, null, 2) + '\n');
}
