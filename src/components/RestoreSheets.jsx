// Restore from a backup file: validate, show what is in it, and let her choose Merge or Replace.
import { Sheet, useDialogs } from '../context/Dialogs.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/Toast.jsx';
import { validateBackup } from '../../js/backup.js';
import { activeCount, totalMinutes } from '../../js/model.js';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const timeEntries = n => `${n} time ${n === 1 ? 'entry' : 'entries'}`;

function ProblemSheet({ title, messages, onClose }) {
  return (
    <Sheet title={title} onClose={onClose}>
      {({ dismiss }) => (
        <div>
          <ul class="problems">{messages.map(m => <li key={m}>{m}</li>)}</ul>
          <p class="muted">Nothing was changed.</p>
          <div class="button-row"><button type="button" class="btn primary" onClick={dismiss}>OK</button></div>
        </div>
      )}
    </Sheet>
  );
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

function MergedSheet({ summary, warnings, onClose }) {
  return (
    <Sheet title="Merged" onClose={onClose}>
      {({ dismiss }) => (
        <div>
          <ul class="problems">{mergeSummaryLines(summary).map(l => <li key={l}>{l}</li>)}</ul>
          {warnings.map(w => <p key={w} class="form-error">{w}</p>)}
          <div class="button-row"><button type="button" class="btn primary" onClick={dismiss}>Done</button></div>
        </div>
      )}
    </Sheet>
  );
}

function RestoreSheet({ result, onClose }) {
  const { store, guard } = useApp();
  const dialogs = useDialogs();
  const toast = useToast();
  const current = store.cases();
  const currentEntries = current.reduce((n, c) => n + c.entries.length, 0);
  const minutes = totalMinutes(result.data.cases.flatMap(c => c.entries));

  async function merge(dismiss) {
    dismiss();
    const r = await guard(store.applyMerge(result.data));
    if (!r) return;
    if (!r.ok) dialogs.open(({ close }) => <ProblemSheet title="Could not merge" messages={r.errors} onClose={close} />);
    else dialogs.open(({ close }) => <MergedSheet summary={r.summary} warnings={r.warnings} onClose={close} />);
  }

  async function replace(dismiss) {
    const ok = await dialogs.confirm({
      title: 'Replace everything?',
      message: `This deletes the ${plural(current.length, 'case')} and ${timeEntries(currentEntries)} on this device and replaces them with the backup. This cannot be undone.`,
      confirmLabel: 'Replace', danger: true,
    });
    if (!ok) return;
    dismiss();
    const r = await guard(store.replaceAll(result.data));
    if (r) toast(`Restored ${plural(result.summary.cases, 'case')}`);
  }

  return (
    <Sheet title="Restore backup" onClose={onClose}>
      {({ dismiss }) => (
        <div>
          <p>
            <strong>In the backup: </strong>
            {plural(result.summary.cases, 'case')} ({result.summary.activeCases} active), {timeEntries(result.summary.entries)}, {Math.floor(minutes / 60)}h {minutes % 60}m in total.
          </p>
          <p>
            <strong>On this device now: </strong>
            {plural(current.length, 'case')} ({activeCount(current)} active), {timeEntries(currentEntries)}.
          </p>
          {result.warnings.map(w => <p key={w} class="form-error">{w}</p>)}
          <p class="muted">Merge combines the backup with what is here and keeps the newest version of anything changed on both. Replace throws away what is here first.</p>
          <div class="action-list">
            <button type="button" class="btn primary block" onClick={() => merge(dismiss)}>Merge with this device</button>
            <button type="button" class="btn danger block" onClick={() => replace(dismiss)}>Replace everything on this device</button>
            <button type="button" class="btn block" onClick={dismiss}>Cancel</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Returns startRestore(file): reads and checks the file, then opens the right sheet. */
export function useRestore() {
  const dialogs = useDialogs();
  return async function startRestore(file) {
    let text;
    try { text = await file.text(); }
    catch {
      dialogs.open(({ close }) => <ProblemSheet title="Could not read that file" messages={['The file could not be opened.']} onClose={close} />);
      return;
    }
    const result = validateBackup(text);
    if (!result.ok) {
      dialogs.open(({ close }) => <ProblemSheet title="This backup cannot be restored" messages={result.errors} onClose={close} />);
      return;
    }
    dialogs.open(({ close }) => <RestoreSheet result={result} onClose={close} />);
  };
}
