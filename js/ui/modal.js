// Sheets built on <dialog> (focus trap, Escape to close, inert background come for free).
import { h } from './dom.js';

let counter = 0;

/** Returns { el, close }. onClose runs once after the dialog is gone, however it was closed. */
export function openModal({ title, content, onClose }) {
  const titleId = `modal-title-${++counter}`;
  const api = { el: null, close: () => api.el.open && api.el.close() };
  api.el = h('dialog', { class: 'sheet', 'aria-labelledby': titleId },
    h('div', { class: 'sheet-head' },
      h('h2', { id: titleId }, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', onClick: () => api.close() }, '✕')),
    h('div', { class: 'sheet-body' }, content));
  api.el.addEventListener('close', () => { api.el.remove(); onClose?.(); });
  document.getElementById('modal-root').append(api.el);
  api.el.showModal();
  return api;
}

/** Resolves true only when the confirm button is pressed. */
export function confirmDialog({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    let answer = false;
    const modal = openModal({
      title,
      onClose: () => resolve(answer),
      content: h('div', {},
        h('p', {}, message),
        h('div', { class: 'button-row' },
          h('button', { type: 'button', class: 'btn', onClick: () => modal.close() }, 'Cancel'),
          h('button', {
            type: 'button', class: `btn ${danger ? 'danger' : 'primary'}`,
            onClick: () => { answer = true; modal.close(); },
          }, confirmLabel))),
    });
  });
}

/** A sheet of stacked action buttons: [{ label, danger?, run }]. */
export function actionSheet({ title, actions }) {
  const modal = openModal({
    title,
    content: h('div', { class: 'action-list' },
      actions.map(a => h('button', {
        type: 'button', class: `btn block ${a.danger ? 'danger' : ''}`,
        onClick: () => { modal.close(); a.run(); },
      }, a.label)),
      h('button', { type: 'button', class: 'btn block', onClick: () => modal.close() }, 'Cancel')),
  });
  return modal;
}

let toastTimer = null;

export function showToast(message, { actionLabel, onAction, ms = 6000 } = {}) {
  const host = document.getElementById('toast-root');
  clearTimeout(toastTimer);
  const dismiss = () => host.replaceChildren();
  host.replaceChildren(h('div', { class: 'toast', role: 'status' },
    h('span', {}, message),
    actionLabel && h('button', { type: 'button', class: 'toast-action', onClick: () => { dismiss(); onAction?.(); } }, actionLabel)));
  toastTimer = setTimeout(dismiss, ms);
}
