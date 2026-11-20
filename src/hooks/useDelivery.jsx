// Export CSV and Back up. Both build the file synchronously from the store snapshot and call
// deliverFile() in the same turn as the tap, which is what iOS needs to allow the share sheet.
import { useApp } from '../context/AppContext.jsx';
import { useDialogs } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { PreviewSheet } from '../components/Sheets.jsx';
import { deliverFile } from '../lib/deliverFile.js';
import { buildBackup, backupFilename } from '../../js/backup.js';
import { buildCsv, exportFilename } from '../../js/csv.js';

export function useDelivery() {
  const { store, today, now, guard, fail } = useApp();
  const dialogs = useDialogs();
  const toast = useToast();

  const deliver = file => deliverFile(file).then(result => {
    if (result.outcome === 'preview') dialogs.open(({ close }) => <PreviewSheet {...result} onClose={close} />);
    return result.outcome;
  });

  /** Call directly from a click handler. */
  function backup() {
    const json = JSON.stringify(buildBackup({ cases: store.cases(), tombstones: store.tombstones() }, now()), null, 2);
    return deliver({ filename: backupFilename(today()), mime: 'application/json', content: json })
      .then(async outcome => {
        if (outcome === 'cancelled') return;
        await guard(store.setMeta('lastBackupAt', now()));
        if (outcome === 'shared' || outcome === 'downloaded') toast('Backup saved');
      })
      .catch(e => fail(`Backup failed: ${e?.message ?? e}`));
  }

  /** Call directly from a click handler. range is { start, end } or null for everything. */
  function exportCsv({ kind, range, summary }) {
    const csv = buildCsv(store.cases(), range);
    return deliver({ filename: exportFilename(kind, range?.start ?? today()), mime: 'text/csv', content: csv })
      .then(outcome => {
        if (outcome === 'shared' || outcome === 'downloaded') toast(`Exported ${summary.cases} ${summary.cases === 1 ? 'case' : 'cases'}`);
      })
      .catch(e => fail(`Export failed: ${e?.message ?? e}`));
  }

  return { backup, exportCsv };
}
