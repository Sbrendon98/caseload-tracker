// Tests only: the app formats dates in the user's own language, so pin one for deterministic output.
// (Without this, a machine running with LANG=C prints "2026 M11 15".)
const toLocaleDateString = Date.prototype.toLocaleDateString;
Date.prototype.toLocaleDateString = function pinned(locale, options) {
  return toLocaleDateString.call(this, locale ?? 'en-US', options);
};
