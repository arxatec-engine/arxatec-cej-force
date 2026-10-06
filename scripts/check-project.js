import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ignored = new Set(['node_modules', 'data', 'output', '.git']);

async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const file = join(directory, entry.name);
    if (entry.isDirectory()) {
      await check(file);
    } else if (entry.isFile()) {
      const source = await readFile(file, 'utf8');
      const lines = source.trimEnd().split('\n').length;
      if (lines > 200) throw new Error(`${file}: ${lines} líneas; máximo 200.`);
      if (file.endsWith('.js')) {
        const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        if (result.status !== 0) throw new Error(result.stderr);
      }
    }
  }
}

await check(process.cwd());
console.log('Verificado: sintaxis JavaScript y máximo de 200 líneas por archivo del proyecto.');
