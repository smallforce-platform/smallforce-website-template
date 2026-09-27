import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createViteConfig } from '@open-slide/core/vite';

const project = process.cwd();
const roots = ['slides', 'themes', 'assets'];
async function sourceHash(directory) {
  const hash = createHash('sha256');
  async function visit(relative) {
    for (const entry of (await readdir(path.join(directory, relative), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const name = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Presentation source cannot contain symlinks: ${name}`);
      if (entry.isDirectory()) await visit(name);
      else if (entry.isFile()) { hash.update(name); hash.update('\0'); hash.update(await readFile(path.join(directory, name))); hash.update('\0'); }
    }
  }
  for (const root of roots) await visit(root);
  return hash.digest('hex');
}
const expected = await sourceHash(project);
await mkdir('node_modules/.open-slide', { recursive: true });
const snapshot = await mkdtemp(path.join(project, 'node_modules/.open-slide/build-'));
try {
  for (const root of roots) await cp(path.join(project, root), path.join(snapshot, root), { recursive: true });
  if (await sourceHash(snapshot) !== expected) throw new Error('Slides changed while capturing the reviewed source. Review and build again.');
  await cp(path.join(project, 'package.json'), path.join(snapshot, 'package.json'));
  await symlink(path.join(project, 'node_modules'), path.join(snapshot, 'node_modules'), 'dir');
  const core = import.meta.resolve('@open-slide/core/vite');
  const { build } = await import(pathToFileURL(createRequire(core).resolve('vite')).href);
  const config = await createViteConfig({ userCwd: snapshot, config: { slidesDir: 'slides', themesDir: 'themes', assetsDir: 'assets' }, mode: 'build' });
  config.envDir = false;
  config.build = { ...config.build, outDir: path.join(project, 'dist/client'), emptyOutDir: true };
  await mkdir(path.join(project, 'dist'), { recursive: true });
  for (const name of await readdir(path.join(project, 'dist'))) await rm(path.join(project, 'dist', name), { recursive: true, force: true });
  await build(config);
  if (await sourceHash(project) !== expected) throw new Error('Slides changed during the build. Review the saved deck and build again.');
} finally {
  await rm(snapshot, { recursive: true, force: true });
}
