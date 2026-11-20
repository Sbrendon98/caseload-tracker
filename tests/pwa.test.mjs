import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from './harness.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(join(root, p), 'utf8');

function walk(dir) {
  return readdirSync(join(root, dir)).flatMap(name => {
    const rel = join(dir, name);
    return statSync(join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });
}

function pngSize(path) {
  const b = readFileSync(join(root, path));
  assert.equal(b.subarray(1, 4).toString('ascii'), 'PNG', `${path} is not a PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

test('manifest is installable and its icons exist at the declared sizes', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  assert.equal(m.name, 'Caseload Tracker');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, './');
  assert.equal(m.scope, './');
  assert.ok(m.icons.some(i => i.sizes === '192x192'));
  assert.ok(m.icons.some(i => i.sizes === '512x512'));
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
  for (const icon of m.icons) {
    const [w, h] = icon.sizes.split('x').map(Number);
    assert.deepEqual(pngSize(join('public', icon.src)), { w, h }, `${icon.src} is not ${icon.sizes}`);
  }
});

test('apple-touch-icon is a 180x180 PNG and index.html links everything iOS needs', () => {
  assert.deepEqual(pngSize('public/icons/apple-touch-icon.png'), { w: 180, h: 180 });
  const html = read('index.html');
  assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon" href="icons\/apple-touch-icon\.png"/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /apple-mobile-web-app-capable/);
  assert.match(html, /prefers-color-scheme: dark/);
});

test('index.html uses relative paths (GitHub Pages sub-path); only the Vite entry is root-absolute', () => {
  const html = read('index.html');
  const absolute = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(absolute, ['/src/main.jsx']);
  assert.match(read('vite.config.js'), /base: '\.\/'/);
});

test('the production build carries a Content-Security-Policy that forbids every network connection', () => {
  assert.match(read('index.html'), /<!--csp-->/);
  const config = read('vite.config.js');
  assert.match(config, /"connect-src 'none'"/);
  assert.match(config, /"object-src 'none'"/);
  assert.match(config, /"default-src 'self'"/);
});

test('the app makes no network requests and loads nothing from elsewhere', () => {
  const files = [...walk('js'), ...walk('src'), 'index.html', 'public/manifest.webmanifest'];
  for (const f of files) {
    const text = read(f);
    assert.doesNotMatch(text, /https?:\/\//, `${f} mentions an external URL`);
    if (/\.(js|jsx)$/.test(f)) {
      assert.doesNotMatch(text, /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|importScripts/, `${f} can talk to the network`);
    }
  }
});

test('only two libraries ship to the phone, so the data-handling surface stays small', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(Object.keys(pkg.dependencies), ['preact']);
});
