// Options: backup and restore, CSV export, week start, storage, and the tutorials.
import { useRef, useState } from 'preact/hooks';
import { useApp } from '../context/AppContext.jsx';
import { useDialogs } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { Page } from '../components/Page.jsx';
import { useRestore } from '../components/RestoreSheets.jsx';
import { useDelivery } from '../hooks/useDelivery.jsx';
import { openTutorial, useTutorial } from '../hooks/useTutorial.jsx';
import { formatDateShort } from '../../js/format.js';
import { inRange, rangeFor, todayLocal } from '../../js/dates.js';
import { routes } from '../../js/router.js';
import { TOPICS } from '../../js/tutorials.js';

const RANGES = [
  { kind: 'week', label: 'Week' },
  { kind: 'month', label: 'Month' },
  { kind: 'schoolyear', label: 'School year' },
  { kind: 'all', label: 'All' },
];

function Choice({ name, checked, onChange, children }) {
  return (
    <label class="seg">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      <span>{children}</span>
    </label>
  );
}

export function OptionsPage() {
  const { store, today, guard, tutorialsShown } = useApp();
  const dialogs = useDialogs();
  const toast = useToast();
  const { backup, exportCsv } = useDelivery();
  const startRestore = useRestore();
  const fileInput = useRef(null);
  const [kind, setKind] = useState('week');
  useTutorial('exportBackup');

  const weekStart = store.getMeta('weekStart', 0);
  const range = rangeFor(kind, today(), weekStart);
  const entryCount = store.cases().flatMap(c => c.entries).filter(e => inRange(e.date, range)).length;
  const rangeText = range ? `${formatDateShort(range.start)} to ${formatDateShort(range.end)}` : 'Everything, all dates';
  const lastBackup = store.getMeta('lastBackupAt');

  return (
    <Page title="Options" back={{ label: 'Cases', href: routes.list() }}>
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

      <section class="card">
        <h2>Export CSV</h2>
        <fieldset class="segmented">
          <legend class="label">Export range</legend>
          {RANGES.map(r => <Choice key={r.kind} name="range" checked={r.kind === kind} onChange={() => setKind(r.kind)}>{r.label}</Choice>)}
        </fieldset>
        <p class="muted">{rangeText}</p>
        <p>{entryCount} {entryCount === 1 ? 'entry' : 'entries'} in this range</p>
        <div class="button-row">
          <button type="button" class="btn primary" disabled={entryCount === 0} onClick={() => exportCsv({ kind, range, entryCount })}>Export CSV</button>
        </div>
      </section>

      <section class="card">
        <h2>Calendar</h2>
        <fieldset class="segmented">
          <legend class="label">Week starts on</legend>
          {[['Sunday', 0], ['Monday', 1]].map(([label, value]) => (
            <Choice key={label} name="weekStart" checked={weekStart === value} onChange={() => guard(store.setMeta('weekStart', value))}>{label}</Choice>
          ))}
        </fieldset>
      </section>

      <section class="card">
        <h2>Storage</h2>
        <p class="muted">
          {store.getMeta('persistGranted')
            ? 'This device has agreed to keep your data unless you clear it yourself.'
            : 'This device has not promised to keep your data when it is low on space. Backups matter.'}
        </p>
      </section>

      <section class="card">
        <h2>Tutorials</h2>
        <p class="muted">Replay any tutorial. Each one also appears once by itself the first time you reach that feature.</p>
        <div class="action-list">
          {TOPICS.map(t => <button key={t.id} type="button" class="btn block" onClick={() => openTutorial(dialogs, t.id)}>{t.title}</button>)}
        </div>
        <div class="button-row">
          <button
            type="button" class="btn"
            onClick={async () => {
              tutorialsShown.clear();
              await guard(store.setMeta('tutorialsSeen', undefined));
              toast('Tutorials will appear again as you use the app.');
            }}
          >
            Show all tutorials again
          </button>
        </div>
      </section>
    </Page>
  );
}
