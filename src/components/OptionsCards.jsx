// The cards on the Options screen. Each one does a single thing; OptionsPage just stacks them.
import { useRef, useState } from 'preact/hooks';
import { useApp } from '../context/AppContext.jsx';
import { useDialogs } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { useRestore } from './RestoreSheets.jsx';
import { useDelivery } from '../hooks/useDelivery.jsx';
import { openTutorial } from '../hooks/useTutorial.jsx';
import { formatDateShort } from '../../js/format.js';
import { rangeFor, todayLocal } from '../../js/dates.js';
import { rangeSummary } from '../../js/csv.js';
import { plural } from '../../js/plural.js';
import { TOPICS } from '../../js/tutorials.js';

const RANGES = [
  { kind: 'week', label: 'Week' },
  { kind: 'month', label: 'Month' },
  { kind: 'schoolyear', label: 'School year' },
  { kind: 'all', label: 'All' },
];

/** One pill-shaped radio option. */
function Choice({ name, checked, onChange, children }) {
  return (
    <label class="seg">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

export function BackupCard() {
  const { store } = useApp();
  const { backup } = useDelivery();
  const startRestore = useRestore();
  const fileInput = useRef(null);
  const lastBackup = store.getMeta('lastBackupAt');

  return (
    <section class="card">
      <h2>Back up your data</h2>
      <p class="notice">
        Your cases and time are stored only on this device. If Safari data is cleared, the app is deleted, or you change phones,
        they are gone. Back up regularly and keep the file somewhere safe, like iCloud Drive.
      </p>
      <p class="muted">{lastBackup ? `Last backup: ${formatDateShort(todayLocal(new Date(lastBackup)))}` : 'You have not made a backup yet.'}</p>
      <div class="button-row split">
        <button type="button" class="btn primary" onClick={backup}>Back up</button>
        <button type="button" class="btn" onClick={() => fileInput.current.click()}>Restore…</button>
        <input
          ref={fileInput} type="file" accept="application/json,.json" class="visually-hidden" aria-label="Choose a backup file"
          onChange={e => { const file = e.currentTarget.files[0]; e.currentTarget.value = ''; if (file) startRestore(file); }}
        />
      </div>
    </section>
  );
}

export function ExportCard() {
  const { store, today } = useApp();
  const { exportCsv } = useDelivery();
  const [kind, setKind] = useState('week');
  const range = rangeFor(kind, today(), store.getMeta('weekStart', 0));
  const summary = rangeSummary(store.cases(), range);
  const rangeText = range ? `${formatDateShort(range.start)} to ${formatDateShort(range.end)}` : 'Everything, all dates';

  return (
    <section class="card">
      <h2>Export CSV</h2>
      <fieldset class="segmented">
        <legend class="label">Export range</legend>
        {RANGES.map(r => <Choice key={r.kind} name="range" checked={r.kind === kind} onChange={() => setKind(r.kind)}>{r.label}</Choice>)}
      </fieldset>
      <p class="muted">{rangeText}</p>
      <p>
        {plural(summary.cases, 'case')} with time in this range
        <span class="muted"> ({plural(summary.entries, 'entry', 'entries')})</span>
      </p>
      <div class="button-row">
        <button type="button" class="btn primary" disabled={summary.cases === 0} onClick={() => exportCsv({ kind, range, summary })}>Export CSV</button>
      </div>
    </section>
  );
}

export function WeekStartCard() {
  const { store, guard } = useApp();
  const weekStart = store.getMeta('weekStart', 0);
  return (
    <section class="card">
      <h2>Calendar</h2>
      <fieldset class="segmented">
        <legend class="label">Week starts on</legend>
        {[['Sunday', 0], ['Monday', 1]].map(([label, value]) => (
          <Choice key={label} name="weekStart" checked={weekStart === value} onChange={() => guard(store.setMeta('weekStart', value))}>{label}</Choice>
        ))}
      </fieldset>
    </section>
  );
}

export function StorageCard() {
  const { store } = useApp();
  return (
    <section class="card">
      <h2>Storage</h2>
      <p class="muted">
        {store.getMeta('persistGranted')
          ? 'This device has agreed to keep your data unless you clear it yourself.'
          : 'This device has not promised to keep your data when it is low on space. Backups matter.'}
      </p>
    </section>
  );
}

export function TutorialsCard() {
  const { store, guard, tutorialsShown } = useApp();
  const dialogs = useDialogs();
  const toast = useToast();

  async function showAllAgain() {
    tutorialsShown.clear();
    await guard(store.setMeta('tutorialsSeen', undefined));
    toast('Tutorials will appear again as you use the app.');
  }

  return (
    <section class="card">
      <h2>Tutorials</h2>
      <p class="muted">Replay any tutorial. Each one also appears once by itself the first time you reach that feature.</p>
      <div class="action-list">
        {TOPICS.map(t => <button key={t.id} type="button" class="btn block" onClick={() => openTutorial(dialogs, t.id)}>{t.title}</button>)}
      </div>
      <div class="button-row">
        <button type="button" class="btn" onClick={showAllAgain}>Show all tutorials again</button>
      </div>
    </section>
  );
}
