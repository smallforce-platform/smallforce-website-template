import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

test('generated project guidance describes SmallForce without exposing its hosting runtime brand', async () => {
  const root = fileURLToPath(new URL('../templates/', import.meta.url));
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (['node_modules', 'dist', '.git'].includes(entry.name) || entry.isSymbolicLink()) continue;
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filename);
      else if (entry.isFile() && filename.endsWith('.md')) {
        assert.doesNotMatch(await readFile(filename, 'utf8'), /\bcelld\b/i, path.relative(root, filename));
      }
    }
  }
  await visit(root);
});
