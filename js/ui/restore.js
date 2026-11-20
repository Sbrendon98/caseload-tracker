// Restore from a backup file: validate, show what is in it, and let her choose Merge or Replace.
import { h } from './dom.js';
import { openModal, confirmDialog, showToast } from './modal.js';
import { validateBackup } from '../backup.js';
import { activeCount, totalMinutes } from '../model.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const timeEntries = n => `${n} time ${n === 1 ? 'entry' : 'entries'}`;

function problemSheet(title, messages) {
  const modal = openModal({
    title,
    content: h('div', {},
      h('ul', { class: 'problems' }, messages.map(m => h('li', {}, m))),
      h('p', { class: 'muted' }, 'Nothing was changed.'),
      h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn primary', onClick: () => modal.close() }, 'OK'))),
  });
}

function mergeSummaryLines(s) {
  const lines = [];
  if (s.casesAdded) lines.push(`${plural(s.casesAdded, 'case')} added`);
  if (s.casesUpdated) lines.push(`${plural(s.casesUpdated, 'case')} updated`);
  if (s.casesRemoved) lines.push(`${plural(s.casesRemoved, 'case')} removed (deleted on the other device)`);
  if (s.entriesAdded) lines.push(`${timeEntries(s.entriesAdded)} added`);
  if (s.entriesUpdated) lines.push(`${timeEntries(s.entriesUpdated)} updated`);
  if (s.entriesRemoved) lines.push(`${timeEntries(s.entriesRemoved)} removed (deleted on the other device)`);
  return lines.length ? lines : ['Everything in the backup was already here. Nothing changed.'];
}

export async function startRestore(ctx, file) {
  let text;
  try { text = await file.text(); }
  catch { problemSheet('Could not read that file', ['The file could not be opened.']); return; }

  const result = validateBackup(text);
  if (!result.ok) { problemSheet('This backup cannot be restored', result.errors); return; }

  const { store } = ctx;
  const current = store.cases();
  const currentEntries = current.reduce((n, c) => n + c.entries.length, 0);
  const incoming = result.data.cases;
  const incomingMinutes = totalMinutes(incoming.flatMap(c => c.entries));
  let modal;

  async function merge() {
    modal.close();
    const r = await ctx.guard(store.applyMerge(result.data));
    if (!r) return;
    if (!r.ok) { problemSheet('Could not merge', r.errors); return; }
    const done = openModal({
      title: 'Merged',
      content: h('div', {},
        h('ul', { class: 'problems' }, mergeSummaryLines(r.summary).map(l => h('li', {}, l))),
        r.warnings.map(w => h('p', { class: 'form-error' }, w)),
        h('div', { class: 'button-row' }, h('button', { type: 'button', class: 'btn primary', onClick: () => done.close() }, 'Done'))),
    });
  }

  async function replace() {
    const ok = await confirmDialog({
      title: 'Replace everything?',
      message: `This deletes the ${plural(current.length, 'case')} and ${timeEntries(currentEntries)} on this device and replaces them with the backup. This cannot be undone.`,
      confirmLabel: 'Replace', danger: true,
    });
    if (!ok) return;
    modal.close();
    const r = await ctx.guard(store.replaceAll(result.data));
    if (r) showToast(`Restored ${plural(result.summary.cases, 'case')}`);
  }

  modal = openModal({
    title: 'Restore backup',
    content: h('div', {},
      h('p', {}, h('strong', {}, 'In the backup: '),
        `${plural(result.summary.cases, 'case')} (${result.summary.activeCases} active), ${timeEntries(result.summary.entries)}, ${Math.floor(incomingMinutes / 60)}h ${incomingMinutes % 60}m in total.`),
      h('p', {}, h('strong', {}, 'On this device now: '),
        `${plural(current.length, 'case')} (${activeCount(current)} active), ${timeEntries(currentEntries)}.`),
      result.warnings.map(w => h('p', { class: 'form-error' }, w)),
      h('p', { class: 'muted' }, 'Merge combines the backup with what is here and keeps the newest version of anything changed on both. Replace throws away what is here first.'),
      h('div', { class: 'action-list' },
        h('button', { type: 'button', class: 'btn primary block', onClick: merge }, 'Merge with this device'),
        h('button', { type: 'button', class: 'btn danger block', onClick: replace }, 'Replace everything on this device'),
        h('button', { type: 'button', class: 'btn block', onClick: () => modal.close() }, 'Cancel'))),
  });
}
