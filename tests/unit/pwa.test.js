import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

import { ROOT, precacheList, updateServiceWorker, versionFor } from '../../scripts/sw-version.js';

const OUT_OF_DATE = 'sw.js is out of date: run `npm run sw:version`';
const SITE = 'https://example.org/heal/';

class FakeRequest {
  constructor(url, { cache = 'default', method = 'GET' } = {}) {
    this.url = url;
    this.cache = cache;
    this.method = method;
  }
}

// Runs sw.js with stand-ins for the service worker APIs it uses.
function loadServiceWorker({ fetch = async () => 'from the network', saved = {} } = {}) {
  const listeners = {};
  const calls = [];
  const stores = new Map(Object.entries(saved).map(([name, entries]) => [name, new Map(Object.entries(entries))]));
  const withoutSearch = (url) => url.split('?')[0];
  const cacheFor = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const store = stores.get(name);
    return {
      async addAll(requests) {
        for (const request of requests) store.set(request.url, `saved ${request.url} (${request.cache})`);
      },
      async match(request, { ignoreSearch } = {}) {
        const url = typeof request === 'string' ? request : request.url;
        for (const [key, response] of store) {
          if (ignoreSearch ? withoutSearch(key) === withoutSearch(url) : key === url) return response;
        }
        return undefined;
      },
    };
  };
  const self = {
    location: new URL(`${SITE}sw.js`),
    addEventListener: (type, listener) => (listeners[type] = listener),
    skipWaiting: async () => calls.push('skipWaiting'),
    clients: { claim: async () => calls.push('claim') },
  };
  const caches = {
    open: async (name) => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
  const source = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const { VERSION, ASSETS } = vm.runInNewContext(`${source}\n;({ VERSION, ASSETS })`, { self, caches, fetch, Request: FakeRequest, URL });

  // Fires an install or activate event and waits for it to finish.
  const lifecycle = async (type) => {
    let work;
    listeners[type]({ waitUntil: (promise) => (work = promise) });
    await work;
  };
  // Fires a fetch event. Returns undefined if the service worker leaves it to the browser.
  const request = (path, method = 'GET') => {
    let response;
    listeners.fetch({ request: new FakeRequest(new URL(path, SITE).href, { method }), respondWith: (promise) => (response = promise) });
    return response;
  };
  return { VERSION, ASSETS: [...ASSETS], stores, calls, lifecycle, request };
}

test('sw.js saves every page, the manifest and everything under assets/', () => {
  const { ASSETS } = loadServiceWorker();
  assert.deepEqual(ASSETS, precacheList(), OUT_OF_DATE);
  assert.ok(ASSETS.includes('index.html') && ASSETS.includes('assets/css/styles.css'));
});

test('sw.js has the version of the files it saves', () => {
  const { VERSION, ASSETS } = loadServiceWorker();
  assert.equal(VERSION, versionFor(ASSETS), OUT_OF_DATE);
});

test('the version changes with any file, but not with line endings', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'heal-sw-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'assets/icons'), { recursive: true });
  writeFileSync(join(root, 'index.html'), '<p>Hi</p>\n');
  writeFileSync(join(root, 'notes.md'), 'Not part of the site');
  writeFileSync(join(root, 'manifest.webmanifest'), '{}\n');
  writeFileSync(join(root, 'assets/app.js'), 'one();\ntwo();\n');
  writeFileSync(join(root, 'assets/.DS_Store'), '');
  writeFileSync(join(root, 'assets/icons/icon.png'), Buffer.from([1, 13, 10, 2]));

  const paths = precacheList(root);
  assert.deepEqual(paths, ['assets/app.js', 'assets/icons/icon.png', 'index.html', 'manifest.webmanifest']);
  const version = versionFor(paths, root);
  assert.match(version, /^[0-9a-f]{12}$/);

  writeFileSync(join(root, 'assets/app.js'), 'one();\r\ntwo();\r\n');
  assert.equal(versionFor(paths, root), version, 'Windows line endings in a text file');

  writeFileSync(join(root, 'assets/icons/icon.png'), Buffer.from([1, 10, 2]));
  assert.notEqual(versionFor(paths, root), version, 'the same bytes in an image are a real change');
  writeFileSync(join(root, 'assets/icons/icon.png'), Buffer.from([1, 13, 10, 2]));

  writeFileSync(join(root, 'index.html'), '<p>Hello</p>\n');
  assert.notEqual(versionFor(paths, root), version);
});

test('updating sw.js changes only the version and the list of files', () => {
  const source = "const VERSION = 'old';\nconst ASSETS = [\n  'gone.js',\n];\n\nconst CACHE = `heal-${VERSION}`;\n";
  const updated = updateServiceWorker(source, ['a.html', "it's.js", 'cost-$&.js'], 'abc123');
  assert.equal(updated, "const VERSION = 'abc123';\nconst ASSETS = [\n  'a.html',\n  'it\\'s.js',\n  'cost-$&.js',\n];\n\nconst CACHE = `heal-${VERSION}`;\n");
  assert.deepEqual([...vm.runInNewContext(`${updated};ASSETS`)], ['a.html', "it's.js", 'cost-$&.js']);
});

test('installing saves every file fresh from the network, then takes over', async () => {
  const worker = loadServiceWorker();
  await worker.lifecycle('install');
  const saved = worker.stores.get(`heal-${worker.VERSION}`);
  assert.deepEqual([...saved.keys()], worker.ASSETS.map((path) => `${SITE}${path}`));
  assert.equal(saved.get(`${SITE}index.html`), `saved ${SITE}index.html (reload)`);
  assert.deepEqual(worker.calls, ['skipWaiting']);
});

test('taking over deletes older copies of Heal but nothing else', async () => {
  const worker = loadServiceWorker({ saved: { 'heal-old': {}, 'another-app': {} } });
  await worker.lifecycle('install');
  await worker.lifecycle('activate');
  assert.deepEqual([...worker.stores.keys()].sort(), ['another-app', `heal-${worker.VERSION}`]);
  assert.deepEqual(worker.calls, ['skipWaiting', 'claim']);
});

test('pages come from the network when it is there', async () => {
  const worker = loadServiceWorker();
  await worker.lifecycle('install');
  assert.equal(await worker.request('you.html'), 'from the network');
});

test('offline, pages come from the saved copy', async () => {
  const offline = new TypeError('Failed to fetch');
  const worker = loadServiceWorker({
    fetch: async () => {
      throw offline;
    },
  });
  await worker.lifecycle('install');
  assert.equal(await worker.request('you.html'), `saved ${SITE}you.html (reload)`);
  assert.equal(await worker.request('impact.html?from=home'), `saved ${SITE}impact.html (reload)`, 'ignores the query');
  assert.equal(await worker.request('./'), `saved ${SITE}index.html (reload)`, "the site's address is its home page");
  await assert.rejects(worker.request('nowhere.html'), offline, 'nothing saved, so it fails as it would without Heal');
});

test('other sites and changes are left to the browser', () => {
  const worker = loadServiceWorker();
  assert.equal(worker.request('https://example.com/heal/index.html'), undefined);
  assert.equal(worker.request('index.html', 'POST'), undefined);
});

test('the manifest describes an installable app that opens on the home page', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.name, 'Heal');
  assert.equal(manifest.display, 'standalone');
  assert.equal(new URL(manifest.start_url, SITE).href, `${SITE}index.html`);
  assert.equal(new URL(manifest.scope, SITE).href, SITE);

  // The icon files exist and are the size the manifest says. A PNG stores its
  // width and height at bytes 16 to 23.
  for (const icon of manifest.icons) {
    const png = readFileSync(join(ROOT, icon.src));
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes, icon.src);
  }
  const sizes = (purpose) => manifest.icons.filter((icon) => icon.purpose === purpose).map((icon) => icon.sizes);
  assert.deepEqual(sizes('any'), ['192x192', '512x512']);
  assert.deepEqual(sizes('maskable'), ['512x512']);

  // Each shortcut goes to a part of a page that exists.
  for (const { url } of manifest.shortcuts) {
    const [page, id] = new URL(url, SITE).href.slice(SITE.length).split('#');
    assert.ok(readFileSync(join(ROOT, page), 'utf8').includes(`id="${id}"`), url);
  }
});

test('every page links the manifest', () => {
  for (const page of precacheList().filter((path) => path.endsWith('.html'))) {
    assert.ok(readFileSync(join(ROOT, page), 'utf8').includes('<link rel="manifest" href="manifest.webmanifest">'), page);
  }
});
