import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { detectEnv } from '../js/env.js';

const win = matches => ({ matchMedia: () => ({ matches }) });
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15';

test('iPhone in a Safari tab: iOS, not standalone', () => {
  assert.deepEqual(detectEnv({ userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5 }, win(false)), { isIOS: true, isStandalone: false });
});
test('iPhone home-screen app: navigator.standalone is true', () => {
  assert.deepEqual(detectEnv({ userAgent: IPHONE, standalone: true }, win(false)), { isIOS: true, isStandalone: true });
});
test('display-mode: standalone also counts as installed', () => {
  assert.equal(detectEnv({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 }, win(true)).isStandalone, true);
});
test('iPadOS reports a Mac user agent but has touch: still iOS', () => {
  assert.equal(detectEnv({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 }, win(false)).isIOS, true);
});
test('a Mac or other desktop is not iOS', () => {
  assert.equal(detectEnv({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 }, win(false)).isIOS, false);
});
test('missing matchMedia does not throw', () => {
  assert.equal(detectEnv({ userAgent: MAC }, {}).isStandalone, false);
});
