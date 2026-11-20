// "Back up" is offered on the Options screen and in banners, so the action lives here.
// Call it synchronously from a click handler (see share.js).
import { deliverFile } from './share.js';
import { showToast } from './modal.js';
import { buildBackup, backupFilename } from '../backup.js';

export function runBackup(ctx) {
  const { store } = ctx;
  const json = JSON.stringify(buildBackup({ cases: store.cases(), tombstones: store.tombstones() }), null, 2);
  return deliverFile({ filename: backupFilename(ctx.today()), mime: 'application/json', content: json })
    .then(async outcome => {
      if (outcome === 'cancelled') return;
      await ctx.guard(store.setMeta('lastBackupAt', ctx.now()));
      if (outcome === 'shared' || outcome === 'downloaded') showToast('Backup saved');
      ctx.rerender();
    })
    .catch(e => ctx.fail(`Backup failed: ${e?.message ?? e}`));
}
