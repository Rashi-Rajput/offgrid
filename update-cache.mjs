import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = fileURLToPath(new URL('./dist/', import.meta.url));
const entries = await readdir(dir, { recursive: true, withFileTypes: true });
const files = entries.filter(entry => entry.isFile())
  .map(entry => relative(dir, join(entry.parentPath, entry.name)).split(sep).join('/'))
  .filter(file => !['sw.js', 'offline-assets.js', 'vendor/LICENSE.txt'].includes(file)).sort();
const hash = createHash('sha256');
for (const file of files) hash.update(file).update(await readFile(join(dir, file)));
const version = hash.digest('hex').slice(0, 20);
await writeFile(join(dir, 'offline-assets.js'),
  'self.OFFGRID_ASSETS = ' + JSON.stringify({ version, files }, null, 2) + ';\n');
console.log(`Offline shell ${version} includes ${files.length} files.`);
