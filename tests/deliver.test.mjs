import assert from 'node:assert/strict';
import { vi } from 'vitest';
import { test } from './harness.mjs';
import { deliverFile } from '../src/lib/deliverFile.js';

const spec = { filename: 'caseload-week-2026-11-15.csv', mime: 'text/csv', content: 'a,b\r\n1,2\r\n' };
const never = () => { throw new Error('should not be called'); };

test('shares the file in the same tick as the call, before any await (iOS needs the tap to be fresh)', async () => {
  const share = vi.fn(() => Promise.resolve());
  const pending = deliverFile(spec, { navigator: { canShare: () => true, share }, download: never, isStandalone: () => false });
  assert.equal(share.mock.calls.length, 1); // already called, nothing awaited yet
  const [{ files, title }] = share.mock.calls[0];
  assert.equal(files[0].name, spec.filename);
  assert.equal(files[0].type, 'text/csv');
  assert.equal(await files[0].text(), spec.content);
  assert.equal(title, spec.filename);
  assert.deepEqual(await pending, { outcome: 'shared' });
});

test('dismissing the share sheet is a cancel, not an error and not a download', async () => {
  const abort = Object.assign(new Error('dismissed'), { name: 'AbortError' });
  const result = await deliverFile(spec, {
    navigator: { canShare: () => true, share: () => Promise.reject(abort) }, download: never, isStandalone: () => false,
  });
  assert.deepEqual(result, { outcome: 'cancelled' });
});

test('if sharing fails for another reason, it falls back to a download in a browser tab', async () => {
  const denied = Object.assign(new Error('no activation'), { name: 'NotAllowedError' });
  const download = vi.fn();
  const result = await deliverFile(spec, {
    navigator: { canShare: () => true, share: () => Promise.reject(denied) }, download, isStandalone: () => false,
  });
  assert.deepEqual(result, { outcome: 'downloaded' });
  assert.equal(download.mock.calls[0][1], spec.filename);
});

test('a share that throws synchronously also falls back', async () => {
  const download = vi.fn();
  const result = await deliverFile(spec, {
    navigator: { canShare: () => true, share: () => { throw new TypeError('bad'); } }, download, isStandalone: () => false,
  });
  assert.equal(result.outcome, 'downloaded');
  assert.equal(download.mock.calls.length, 1);
});

test('a browser without file sharing downloads the file', async () => {
  const download = vi.fn();
  assert.equal((await deliverFile(spec, { navigator: {}, download, isStandalone: () => false })).outcome, 'downloaded');
  assert.equal((await deliverFile(spec, { navigator: { canShare: () => false }, download, isStandalone: () => false })).outcome, 'downloaded');
  assert.equal(download.mock.calls.length, 2);
});

test('inside the installed iOS app, where <a download> is unreliable, it offers a text preview instead', async () => {
  const result = await deliverFile(spec, { navigator: { canShare: () => false }, download: never, isStandalone: () => true });
  assert.equal(result.outcome, 'preview');
  assert.equal(result.content, spec.content);
  assert.equal(result.filename, spec.filename);
  assert.match(result.url, /^blob:/);
});
