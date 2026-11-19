// Keeps sw.js in step with Heal's files. It lists every file Heal needs to work
// offline, and sets VERSION to a hash of their contents, so that browsers fetch
// a fresh copy whenever any of them changes.
//
// Run it with `npm run sw:version` after adding, removing or changing a page or
// anything under assets/. The unit tests fail if sw.js is out of date.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SERVICE_WORKER = 'sw.js';

function filesUnder(root, folder) {
  return readdirSync(join(root, folder), { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .flatMap((entry) => (entry.isDirectory() ? filesUnder(root, `${folder}${entry.name}/`) : [`${folder}${entry.name}`]));
}

// The pages, the web app manifest and everything under assets/, as paths
// relative to the site root.
export function precacheList(root = ROOT) {
  const pages = readdirSync(root).filter((name) => name.endsWith('.html'));
  return [...pages, 'manifest.webmanifest', ...filesUnder(root, 'assets/')].sort();
}

// Text files are hashed with Unix line endings, so a checkout with Windows line
// endings gets the same version.
const TEXT_FILE = /\.(css|html|js|json|svg|txt|webmanifest)$/;

export function versionFor(paths, root = ROOT) {
  const hash = createHash('sha256');
  for (const path of paths) {
    const content = readFileSync(join(root, path));
    hash.update(`${path}\0`);
    hash.update(TEXT_FILE.test(path) ? content.toString('utf8').replaceAll('\r\n', '\n') : content);
    hash.update('\0');
  }
  return hash.digest('hex').slice(0, 12);
}

export function updateServiceWorker(source, paths, version) {
  const quote = (path) => `'${path.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
  const assets = `const ASSETS = [\n${paths.map((path) => `  ${quote(path)},`).join('\n')}\n];`;
  return source.replace(/^const VERSION = .*;$/m, () => `const VERSION = '${version}';`).replace(/^const ASSETS = \[[\s\S]*?^\];$/m, () => assets);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = join(ROOT, SERVICE_WORKER);
  const paths = precacheList();
  const version = versionFor(paths);
  const before = readFileSync(file, 'utf8');
  const after = updateServiceWorker(before, paths, version);
  if (after === before) {
    console.log(`${SERVICE_WORKER} is up to date (version ${version}, ${paths.length} files).`);
  } else {
    writeFileSync(file, after);
    console.log(`Updated ${SERVICE_WORKER} to version ${version}, with ${paths.length} files.`);
  }
}
