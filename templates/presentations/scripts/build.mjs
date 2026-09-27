import { spawnSync } from 'node:child_process';
import { mkdirSync, copyFileSync, rmSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

// OS builds execute under the project sandbox; its clean environment avoids recursion.
if (process.env.SMALLFORCE_OS_BASE_URL) {
  const { appId } = JSON.parse(readFileSync('smallforce.json', 'utf8'));
  if (!/^[0-9a-f-]{36}$/.test(appId) || !process.env.SMALLFORCE_API_KEY) throw new Error('Registered OS application credentials are required.');
  const response = await fetch(new URL(`/api/application-projects/registrations/${appId}/editor/build`, process.env.SMALLFORCE_OS_BASE_URL), {
    method: 'POST', headers: { authorization: `Bearer ${process.env.SMALLFORCE_API_KEY}` }, signal: AbortSignal.timeout(130_000),
  });
  if (!response.ok) throw new Error(`Sandboxed presentation build failed (${response.status}). Check the saved source and template checks.`);
  process.exit(0);
}

// Build tools never inherit the SmallForce SDK key or other agent credentials.
const result = spawnSync('node', ['scripts/build-slides.mjs'], {
  cwd: process.cwd(), stdio: 'inherit',
  env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, NODE_ENV: 'production' },
});
if (result.error || result.status !== 0) {
  if (existsSync('dist')) for (const name of readdirSync('dist')) rmSync(path.join('dist', name), { recursive: true, force: true });
  throw result.error ?? new Error(`OpenSlide build failed (${result.status}).`);
}
mkdirSync('dist/worker', { recursive: true });
copyFileSync(path.resolve('worker/entry.mjs'), path.resolve('dist/worker/entry.mjs'));
