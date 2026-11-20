// What kind of device/app container we are running in. Takes navigator/window as arguments so it
// can be tested without a browser.

export function detectEnv(nav = globalThis.navigator, win = globalThis.window) {
  const ua = nav?.userAgent ?? '';
  // iPadOS Safari reports a Mac user agent; the touch screen gives it away.
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (nav?.platform === 'MacIntel' && (nav?.maxTouchPoints ?? 0) > 1);
  const isStandalone = nav?.standalone === true || win?.matchMedia?.('(display-mode: standalone)')?.matches === true;
  return { isIOS, isStandalone };
}
