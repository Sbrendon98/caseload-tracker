// Hands a generated file to the user. iOS only allows navigator.share() while the tap that started
// it is still "fresh", so deliverFile() must be called synchronously from the click handler with the
// content already built (the store keeps an in-memory snapshot, so it is). Nothing here awaits
// before share().
import { detectEnv } from '../../js/env.js';

function browserDownload(file, filename) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Resolves { outcome: 'shared' | 'cancelled' | 'downloaded' } or
 * { outcome: 'preview', filename, content, url } when the caller should show the text on screen.
 * env lets tests inject navigator, download and isStandalone.
 */
export function deliverFile({ filename, mime, content }, env = {}) {
  const nav = env.navigator ?? globalThis.navigator;
  const isStandalone = env.isStandalone ?? (() => detectEnv().isStandalone);
  const download = env.download ?? browserDownload;
  const file = new File([content], filename, { type: mime });

  // <a download> is unreliable inside an installed iOS app, so show the text there with a Copy button.
  const fallback = () => {
    if (isStandalone()) return { outcome: 'preview', filename, content, url: URL.createObjectURL(file) };
    download(file, filename);
    return { outcome: 'downloaded' };
  };

  const canShare = typeof nav?.canShare === 'function' && nav.canShare({ files: [file] });
  if (!canShare) return Promise.resolve(fallback());

  let sharing;
  try { sharing = nav.share({ files: [file], title: filename }); }
  catch { return Promise.resolve(fallback()); }
  return sharing.then(
    () => ({ outcome: 'shared' }),
    e => (e?.name === 'AbortError' ? { outcome: 'cancelled' } : fallback()),
  );
}
