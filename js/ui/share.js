// Hands a generated file to the user. iOS only allows navigator.share() while the tap that started
// it is still "fresh", so deliverFile() must be called synchronously from the click handler, with
// the content already built (the store snapshot makes that possible). Nothing here awaits before share().
import { h } from './dom.js';
import { openModal, showToast } from './modal.js';
import { detectEnv } from '../env.js';

/** Resolves 'shared' | 'cancelled' | 'downloaded' | 'preview'. Call synchronously from a click. */
export function deliverFile({ filename, mime, content }) {
  const file = new File([content], filename, { type: mime });
  const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  if (!canShare) return Promise.resolve(fallback(file, content, filename));
  return navigator.share({ files: [file], title: filename }).then(
    () => 'shared',
    e => (e?.name === 'AbortError' ? 'cancelled' : fallback(file, content, filename)),
  );
}

function fallback(file, content, filename) {
  const url = URL.createObjectURL(file);
  // <a download> is unreliable inside an installed iOS app, so show the text with Copy there.
  if (detectEnv().isStandalone) {
    openPreview({ filename, content, url });
    return 'preview';
  }
  const link = h('a', { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

function openPreview({ filename, content, url }) {
  const box = h('textarea', { readOnly: true, rows: 10, value: content, 'aria-label': filename, spellcheck: false });
  const modal = openModal({
    title: filename,
    onClose: () => URL.revokeObjectURL(url),
    content: h('div', {},
      h('p', {}, 'Your phone could not open the share sheet. Copy this text and paste it into Notes, Mail or a file, or try Open file.'),
      box,
      h('div', { class: 'button-row' },
        h('a', { class: 'btn', href: url, target: '_blank', rel: 'noopener' }, 'Open file'),
        h('button', {
          type: 'button', class: 'btn primary',
          onClick: async () => {
            try { await navigator.clipboard.writeText(content); showToast('Copied'); }
            catch { box.select(); showToast('Select all and copy manually.'); }
          },
        }, 'Copy'),
        h('button', { type: 'button', class: 'btn', onClick: () => modal.close() }, 'Done'))),
  });
}
