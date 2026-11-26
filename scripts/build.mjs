import {createHash} from 'node:crypto';
import {cp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const from = new URL('../public/', import.meta.url);
const to = new URL('../dist/', import.meta.url);
const files = (await readdir(from, {recursive: true, withFileTypes: true}))
  .filter(entry => entry.isFile())
  .map(entry => path.relative(fileURLToPath(from), path.join(entry.parentPath, entry.name)).split(path.sep).join('/'))
  .filter(path => path !== '_headers' && path !== 'sw.js')
  .sort();
const hash = createHash('sha256');
for (const name of [...files, 'sw.js']) {
  hash.update(name + '\0');
  hash.update(await readFile(new URL(name, from)));
}
await rm(to, {recursive: true, force: true});
await cp(from, to, {recursive: true});
const prefix = 'const CACHE_VERSION = ' + JSON.stringify(hash.digest('hex').slice(0, 16)) + ';\n'
  + 'const PRECACHE = ' + JSON.stringify(files.map(name => {
    if (name === 'index.html') return './';
    if (name === 'licenses.html') return './licenses';
    return './' + name;
  })) + ';\n';
await writeFile(new URL('sw.js', to), prefix + await readFile(new URL('sw.js', from), 'utf8'));
console.log('Built dist/ with ' + files.length + ' offline assets.');
