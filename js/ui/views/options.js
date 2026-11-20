// Options: CSV export, backup, restore, week start, and where her data lives.
import { h } from '../dom.js';
import { page } from '../layout.js';
import { routes } from '../router.js';
import { showToast } from '../modal.js';
import { deliverFile } from '../share.js';
import { startRestore } from '../restore.js';
import { formatDateShort } from '../format.js';
import { buildCsv, exportFilename } from '../../csv.js';
import { buildBackup, backupFilename } from '../../backup.js';
import { inRange, rangeFor, todayLocal } from '../../dates.js';

const RANGES = [
  { kind: 'week', label: 'Week' },
  { kind: 'month', label: 'Month' },
  { kind: 'schoolyear', label: 'School year' },
  { kind: 'all', label: 'All' },
];

export function optionsView(ctx) {
  const { store } = ctx;
  const today = ctx.today();
  const weekStart = store.getMeta('weekStart', 0);
  const kind = ctx.state.exportKind ?? 'week';
  const range = rangeFor(kind, today, weekStart);
  const entryCount = store.cases().flatMap(c => c.entries).filter(e => inRange(e.date, range)).length;

  const rangeText = range
    ? `${formatDateShort(range.start)} to ${formatDateShort(range.end)}`
    : 'Everything, all dates';

  // Both handlers build the file synchronously and call deliverFile() in the same turn as the tap.
  function exportCsv() {
    const csv = buildCsv(store.cases(), range);
    deliverFile({ filename: exportFilename(kind, range?.start ?? today), mime: 'text/csv', content: csv })
      .then(outcome => { if (outcome === 'shared' || outcome === 'downloaded') showToast(`Exported ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`); })
      .catch(e => ctx.fail(`Export failed: ${e?.message ?? e}`));
  }

  function backup() {
    const json = JSON.stringify(buildBackup({ cases: store.cases(), tombstones: store.tombstones() }), null, 2);
    deliverFile({ filename: backupFilename(today), mime: 'application/json', content: json })
      .then(async outcome => {
        if (outcome === 'cancelled') return;
        await ctx.guard(store.setMeta('lastBackupAt', ctx.now()));
        if (outcome === 'shared' || outcome === 'downloaded') showToast('Backup saved');
        ctx.rerender();
      })
      .catch(e => ctx.fail(`Backup failed: ${e?.message ?? e}`));
  }

  const lastBackup = store.getMeta('lastBackupAt');
  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', class: 'visually-hidden', 'aria-label': 'Choose a backup file',
    onChange: e => { const file = e.target.files[0]; e.target.value = ''; if (file) startRestore(ctx, file); },
  });

  const rangeChoices = h('fieldset', { class: 'segmented' },
    h('legend', { class: 'label' }, 'Export range'),
    RANGES.map(r => h('label', { class: 'seg' },
      h('input', { type: 'radio', name: 'range', value: r.kind, checked: r.kind === kind, onChange: () => { ctx.state.exportKind = r.kind; ctx.rerender(); } }),
      h('span', {}, r.label))));

  const weekChoices = h('fieldset', { class: 'segmented' },
    h('legend', { class: 'label' }, 'Week starts on'),
    [['Sunday', 0], ['Monday', 1]].map(([label, value]) => h('label', { class: 'seg' },
      h('input', {
        type: 'radio', name: 'weekStart', value: String(value), checked: weekStart === value,
        onChange: async () => { await ctx.guard(store.setMeta('weekStart', value)); ctx.rerender(); },
      }),
      h('span', {}, label))));

  const persisted = store.getMeta('persistGranted');

  const el = page(ctx, { title: 'Options', back: { label: 'Cases', href: routes.list() } },
    h('section', { class: 'card' },
      h('h2', {}, 'Back up your data'),
      h('p', { class: 'notice' }, 'Your cases and time are stored only on this device. If Safari data is cleared, the app is deleted, or you change phones, they are gone. Back up regularly and keep the file somewhere safe, like iCloud Drive.'),
      h('p', { class: 'muted' }, lastBackup ? `Last backup: ${formatDateShort(todayLocal(new Date(lastBackup)))}` : 'You have not made a backup yet.'),
      h('div', { class: 'button-row split' },
        h('button', { type: 'button', class: 'btn primary', onClick: backup }, 'Back up'),
        h('button', { type: 'button', class: 'btn', onClick: () => fileInput.click() }, 'Restore…'),
        fileInput)),

    h('section', { class: 'card' },
      h('h2', {}, 'Export CSV'),
      rangeChoices,
      h('p', { class: 'muted' }, `${rangeText}`),
      h('p', {}, `${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} in this range`),
      h('div', { class: 'button-row' },
        h('button', { type: 'button', class: 'btn primary', disabled: entryCount === 0, onClick: exportCsv }, 'Export CSV'))),

    h('section', { class: 'card' }, h('h2', {}, 'Calendar'), weekChoices),

    h('section', { class: 'card' },
      h('h2', {}, 'Storage'),
      h('p', { class: 'muted' }, persisted
        ? 'This device has agreed to keep your data unless you clear it yourself.'
        : 'This device has not promised to keep your data when it is low on space. Backups matter.')));
  return { el };
}
