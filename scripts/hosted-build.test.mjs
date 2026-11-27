// @vitest-environment node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { onTestFinished, test } from 'vitest';

test('hosted startup repairs missing and damaged compiled files on a warm start', () => {
  const root = mkdtempSync(join(tmpdir(), 'spellful-hosted-build-'));
  onTestFinished(() => rmSync(root, { recursive: true, force: true }));
  const path = name => join(root, name);
  for (const dir of ['scripts', 'src', 'export-plugins', 'public', 'dist/bin', 'dist/client/assets']) {
    mkdirSync(path(dir), { recursive: true });
  }
  for (const name of ['ensure-production-build.mjs', 'hosted-build.mjs']) {
    cpSync(new URL(name, import.meta.url), path('scripts/' + name));
  }
  for (const name of ['package-lock.json', 'vite.config.ts', 'postcss.config.js', 'tailwind.config.js',
    'tsconfig.json', 'tsconfig.node.json', 'index.html', 'airo-media.json']) {
    writeFileSync(path(name), '');
  }
  const script = path('dist/client/assets/app.js');
  const chunk = path('dist/bin/coven.js');
  writeFileSync(script, 'client');
  writeFileSync(chunk, 'server');
  writeFileSync(path('dist/client/index.html'), '<script src="/assets/app.js"></script>');
  writeFileSync(path('dist/server.bundle.mjs'), "import './bin/coven.js';");

  const env = { ...process.env, NOMAD_TASK_DIR: root };
  const run = (...args) => execFileSync(process.execPath, args, { cwd: root, env, encoding: 'utf8' });
  const start = () => run('scripts/ensure-production-build.mjs');
  run('scripts/hosted-build.mjs', '--pack-hosted-build');
  rmSync(path('dist'), { recursive: true });
  start();
  assert.equal(readFileSync(script, 'utf8'), 'client');

  // A healthy warm start should reuse the installed files.
  utimesSync(script, 1234, 1234);
  start();
  assert.equal(statSync(script).mtimeMs, 1234000);

  rmSync(script);
  start();
  assert.equal(readFileSync(script, 'utf8'), 'client');
  writeFileSync(chunk, 'broken'); // Same length as the original.
  start();
  assert.equal(readFileSync(chunk, 'utf8'), 'server');
});
