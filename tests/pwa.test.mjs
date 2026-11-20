import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { test } from './harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap(name => {
    const rel = join(dir, name);
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

function precacheList() {
  const match = /const APP_SHELL = (\[[\s\S]*?\]);/.exec(read('sw.js'));
  assert.ok(match, 'sw.js must define const APP_SHELL = [...]');
  return vm.runInNewContext(match[1]);
}
const toFile = entry => (entry === './' ? 'index.html' : entry.replace(/^\.\//, ''));

function pngSize(path) {
  const b = readFileSync(join(root, path));
  assert.equal(b.subarray(1, 4).toString('ascii'), 'PNG', `${path} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('sw.js has a versioned cache name', () => {
  assert.match(read('sw.js'), /const VERSION = 'v\d+';/);
  assert.match(read('sw.js'), /caseload-\$\{VERSION\}/);
});
test('every precached file exists, and entries are relative (GitHub Pages subpath)', () => {
  for (const entry of precacheList()) {
    assert.ok(entry === './' || entry.startsWith('./'), `${entry} must start with ./`);
    assert.ok(existsSync(join(root, toFile(entry))), `${entry} is precached but missing`);
  }
});
test('every app file is precached, so nothing is missing offline', () => {
  const cached = new Set(precacheList().map(toFile));
  const needed = [
    'index.html', 'styles.css', 'manifest.webmanifest',
    ...walk('js'), ...walk('icons'),
  ];
  const missing = needed.filter(f => !cached.has(f));
  assert.deepEqual(missing, [], `not precached: ${missing.join(', ')}`);
});
test('the precache list has no duplicates', () => {
  const list = precacheList();
  assert.equal(new Set(list).size, list.length);
});
test('manifest is installable and its icons exist at the declared sizes', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.name, 'Caseload Tracker');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.ok(m.icons.some(i => i.sizes === '192x192'));
  assert.ok(m.icons.some(i => i.sizes === '512x512'));
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
  for (const icon of m.icons) {
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngSize(icon.src), { w, h }, `${icon.src} is not ${icon.sizes}`);
  }
});
test('apple-touch-icon is a 180x180 PNG and index.html links everything', () => {
  assert.deepEqual(pngSize('icons/apple-touch-icon.png'), { w: 180, h: 180 });
  const html = read('index.html');
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /prefers-color-scheme: dark/); // theme-color for dark mode
});
test('index.html and the service worker use no root-absolute paths', () => {
  assert.doesNotMatch(read('index.html'), /(?:href|src)="\//);
  assert.doesNotMatch(read('sw.js'), /register\(['"]\//);
});
test('the app makes no network requests and loads nothing from elsewhere', () => {
  const files = [...walk('js'), 'index.html', 'styles.css', 'manifest.webmanifest'];
  for (const f of files) {
    const text = read(f);
    assert.doesNotMatch(text, /https?:\/\//, `${f} mentions an external URL`);
    if (f.endsWith('.js')) {
      assert.doesNotMatch(text, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts/, `${f} can talk to the network`);
    }
  }
});
test('the only network-capable code is the service worker serving its own cache', () => {
  const sw = read('sw.js');
  assert.doesNotMatch(sw, /https?:\/\//);
  assert.match(sw, /cache: 'reload'/); // precache must bypass GitHub Pages' 10 minute HTTP cache
});
test('.nojekyll exists so GitHub Pages serves every file untouched', () => {
  assert.ok(existsSync(join(root, '.nojekyll')));
});
