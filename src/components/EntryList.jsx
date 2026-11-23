// A case's time entries, newest first, with Edit and Delete (delete asks first).
import { useState } from 'preact/hooks';
import { useApp } from '../context/AppContext.jsx';
import { Sheet, useDialogs } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { EntryForm } from './Forms.jsx';
import { formatDateLong } from '../../js/format.js';
import { entrySeconds, formatDurationSeconds } from '../../js/durations.js';

export function EditEntrySheet({ caseId, entry, onClose }) {
  const { store, today, guard } = useApp();
  const toast = useToast();
  const [errors, setErrors] = useState({});
  return (
    <Sheet title="Edit time entry" onClose={onClose}>
      {({ dismiss }) => (
        <EntryForm
          today={today()} submitLabel="Save" errors={errors} onCancel={dismiss}
          initial={{ date: entry.date, hours: String(Math.floor(entry.minutes / 60)), minutes: String(entry.minutes % 60), note: entry.note }}
          onSubmit={async values => {
            // Seconds from a timer are kept unless she changed the hours or minutes.
            const unchanged = Number(values.hours || 0) * 60 + Number(values.minutes || 0) === entry.minutes;
            const r = await guard(store.updateEntry(caseId, entry.id, { ...values, seconds: unchanged ? entry.seconds ?? 0 : 0 }));
            if (!r) return;
            if (!r.ok) { setErrors(r.errors ?? {}); return; }
            dismiss();
            toast('Saved', { ms: 1500 });
          }}
        />
      )}
    </Sheet>
  );
}

const newestFirst = (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt;

export function EntryList({ caseId, entries }) {
  const { store, guard } = useApp();
  const dialogs = useDialogs();
  const sorted = [...entries].sort(newestFirst);

  async function deleteEntry(entry) {
    const ok = await dialogs.confirm({
      title: 'Delete this entry?',
      message: `${formatDateLong(entry.date)}, ${formatDurationSeconds(entrySeconds(entry))}. This cannot be undone.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (ok) await guard(store.deleteEntry(caseId, entry.id));
  }

  const edit = entry => dialogs.open(({ close }) => <EditEntrySheet caseId={caseId} entry={entry} onClose={close} />);

  return (
    <section class="card">
      <h2>Entries ({sorted.length})</h2>
      {sorted.length === 0
        ? <p class="muted">No time logged yet.</p>
        : (
          <ul class="entries">
            {sorted.map(e => (
              <li key={e.id} class="entry">
                <div class="entry-head">
                  <span class="entry-date">{formatDateLong(e.date)}</span>
                  <span class="entry-time">{formatDurationSeconds(entrySeconds(e))}</span>
                </div>
                {e.note && <p class="entry-note">{e.note}</p>}
                <div class="entry-actions">
                  <button type="button" class="btn small" onClick={() => edit(e)}>Edit</button>
                  <button type="button" class="btn small danger" onClick={() => deleteEntry(e)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
