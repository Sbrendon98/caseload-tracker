// Case detail: total, due date, notes, timer, add time, entries, and case actions.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../context/AppContext.jsx';
import { Sheet, useDialogs } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { Page } from '../components/Page.jsx';
import { EntryForm, NOTES_PLACEHOLDER } from '../components/Forms.jsx';
import { useCaseActions } from '../hooks/useCaseActions.jsx';
import { useDebounced } from '../hooks/useDebounced.js';
import { useTutorial } from '../hooks/useTutorial.jsx';
import { navigate } from '../hooks/useRoute.js';
import { formatClock, formatDateLong } from '../../js/format.js';
import { fromDateTimeLocal, todayLocal, toDateTimeLocal } from '../../js/dates.js';
import { routes } from '../../js/router.js';
import { entrySeconds, formatDurationSeconds, totalSeconds } from '../../js/durations.js';
import { timerStop, validateTimerStart } from '../../js/timer.js';
import { validateEntry } from '../../js/entries.js';

/** Fix when a timer was started late or forgotten. Also shown when it has run past 24 hours. */
function StartTimeSheet({ startedAt, tooLong, onSave, onClose }) {
  const { now } = useApp();
  const [value, setValue] = useState(toDateTimeLocal(startedAt));
  const [error, setError] = useState(null);
  return (
    <Sheet title="Set the start time" onClose={onClose}>
      {({ dismiss }) => (
        <form
          class="form" noValidate
          onSubmit={async e => {
            e.preventDefault();
            const startMs = fromDateTimeLocal(value);
            const check = validateTimerStart(startMs, now());
            if (!check.ok) { setError(check.error); return; }
            await onSave(startMs);
            dismiss();
          }}
        >
          {tooLong && (
            <p class="notice">
              This timer has been running for more than 24 hours, which is longer than one entry can be.
              Set the time you really started, then stop it again. Nothing has been saved yet.
            </p>
          )}
          <label class="field">
            <span class="label">Started at</span>
            <input type="datetime-local" value={value} onInput={e => setValue(e.currentTarget.value)} />
            <span class="field-error" role="alert" hidden={!error}>{error}</span>
          </label>
          <div class="button-row">
            <button type="button" class="btn" onClick={dismiss}>Cancel</button>
            <button type="submit" class="btn primary">Save start time</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

/** Saved when she taps away (blur), not on every keystroke. */
function NotesField({ notes, onSave }) {
  const [text, setText] = useState(notes);
  useEffect(() => setText(notes), [notes]);
  return (
    <textarea
      rows={4} value={text} placeholder={NOTES_PLACEHOLDER} aria-label="Case notes"
      onInput={e => setText(e.currentTarget.value)}
      onBlur={e => { if (e.currentTarget.value !== notes) onSave(e.currentTarget.value); }}
    />
  );
}

function TimerCard({ c }) {
  const { store, now, guard } = useApp();
  const dialogs = useDialogs();
  const toast = useToast();
  const timer = store.getMeta('timer');
  const running = Boolean(timer) && timer.caseId === c.id;
  const [tick, setTick] = useState(now());

  useEffect(() => {
    if (!running) return undefined;
    setTick(now());
    const id = setInterval(() => setTick(now()), 1000);
    return () => clearInterval(id);
  }, [running]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopping = useRef(false); // synchronous, so it blocks a tap that lands before the next render
  const [busy, setBusy] = useState(false);

  const start = () => guard(store.setMeta('timer', { caseId: c.id, startedAt: now() }));

  async function discard() {
    const ok = await dialogs.confirm({ title: 'Discard timer?', message: 'The running time will not be saved.', confirmLabel: 'Discard', danger: true });
    if (ok) await guard(store.setMeta('timer', undefined));
  }

  const openStartTime = (tooLong = false) => dialogs.open(({ close }) => (
    <StartTimeSheet
      startedAt={timer.startedAt} tooLong={tooLong} onClose={close}
      onSave={startMs => guard(store.setMeta('timer', { ...timer, startedAt: startMs }))}
    />
  ));

  /** Saves the entry now; she can correct it afterwards with Edit. Over 24 hours asks instead of guessing. */
  async function stop() {
    if (stopping.current) return; // a second tap while the first save is running
    const result = timerStop(timer.startedAt, now());
    if (!result.ok) { openStartTime(true); return; }
    stopping.current = true;
    setBusy(true);
    try { await save(result); } finally { stopping.current = false; setBusy(false); }
  }

  async function save(result) {
    const r = await guard(store.addEntry(c.id, {
      date: todayLocal(new Date(timer.startedAt)),
      hours: String(Math.floor(result.minutes / 60)),
      minutes: String(result.minutes % 60),
      seconds: result.seconds,
      note: '',
    }));
    if (!r?.ok) return; // a storage error is already on screen; the timer is still running
    await guard(store.setMeta('timer', undefined));
    toast(`Saved ${formatDurationSeconds(entrySeconds(r.entry))}`, {
      actionLabel: 'Edit',
      onAction: () => dialogs.open(({ close }) => <EditEntrySheet caseId={c.id} entry={r.entry} onClose={close} />),
    });
  }

  if (running) {
    return (
      <section class="card">
        <h2>Timer running</h2>
        <p class="clock">{formatClock(tick - timer.startedAt)}</p>
        <p class="muted">Started {new Date(timer.startedAt).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>
        <div class="timer-actions">
          <button type="button" class="btn" onClick={discard}>Discard</button>
          <button type="button" class="btn" onClick={() => openStartTime(false)}>Edit start time</button>
          <button type="button" class="btn primary" disabled={busy} onClick={stop}>Stop timer and save</button>
        </div>
      </section>
    );
  }
  const other = timer && store.getCase(timer.caseId);
  return (
    <section class="card">
      <h2>Timer</h2>
      {other
        ? <p class="muted">A timer is already running for <a href={routes.caseDetail(other.id)}>{other.displayId}</a>.</p>
        : <button type="button" class="btn block" onClick={start}>Start timer</button>}
    </section>
  );
}

function EditEntrySheet({ caseId, entry, onClose }) {
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

export function CasePage({ id }) {
  const { store, today, guard } = useApp();
  const dialogs = useDialogs();
  const toast = useToast();
  const { archiveWithUndo, unarchiveCase, openEditCase } = useCaseActions();
  const [formKey, setFormKey] = useState(0);
  const [errors, setErrors] = useState({});
  const c = store.getCase(id);
  const draftKey = `draft:entry:${id}`;
  const saveDraft = useDebounced(values => guard(store.setMeta(draftKey, values)));
  useTutorial('logTime', { enabled: Boolean(c) });

  if (!c) {
    return (
      <Page title="Case not found" back={{ label: 'Cases', href: routes.list() }}>
        <p class="empty">This case no longer exists.</p>
      </Page>
    );
  }

  const saveField = async patch => {
    const r = await guard(store.updateCase(c.id, {
      initials: c.initials, caseNumber: c.caseNumber, dueDate: c.dueDate ?? '', notes: c.notes, ...patch,
    }));
    if (r?.ok) toast('Saved', { ms: 1500 });
    else if (r) toast('Could not save that change.');
  };

  async function addTime(values) {
    saveDraft.cancel();
    const check = validateEntry(values);
    setErrors(check.ok ? {} : check.errors);
    if (!check.ok) return;
    // Clear the draft first: the new form re-reads it when it is rebuilt.
    if (await guard(store.setMeta(draftKey, undefined)) === null) return;
    const r = await guard(store.addEntry(c.id, values));
    if (r?.ok) {
      toast(`Added ${formatDurationSeconds(entrySeconds(r.entry))}`, { ms: 2500 });
      setFormKey(k => k + 1);
    }
  }

  async function deleteEntry(entry) {
    const ok = await dialogs.confirm({
      title: 'Delete this entry?',
      message: `${formatDateLong(entry.date)}, ${formatDurationSeconds(entrySeconds(entry))}. This cannot be undone.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (ok) await guard(store.deleteEntry(c.id, entry.id));
  }

  async function deleteCase() {
    const n = c.entries.length;
    const ok = await dialogs.confirm({
      title: `Delete ${c.displayId}?`,
      message: `This also deletes its ${n} time ${n === 1 ? 'entry' : 'entries'}. This cannot be undone.`,
      confirmLabel: 'Delete case', danger: true,
    });
    if (!ok) return;
    if (store.getMeta('timer')?.caseId === c.id) await guard(store.setMeta('timer', undefined));
    await guard(store.setMeta(draftKey, undefined));
    const r = await guard(store.deleteCase(c.id));
    if (r) { navigate(routes.list()); toast(`Deleted ${c.displayId}`); }
  }

  const entries = [...c.entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  return (
    <Page title={c.displayId} back={c.archived ? { label: 'Archived', href: routes.archived() } : { label: 'Cases', href: routes.list() }}>
      <section class="card">
        <p class="total-label">{c.archived ? 'Archived · total time' : 'Total time'}</p>
        <p class="total">{formatDurationSeconds(totalSeconds(c.entries))}</p>
        <div class="row-inline">
          <label class="label">
            Due date
            <input type="date" value={c.dueDate ?? ''} aria-label="Due date" onChange={e => saveField({ dueDate: e.currentTarget.value })} />
          </label>
          {c.dueDate && <button type="button" class="btn small" onClick={() => saveField({ dueDate: '' })}>Clear</button>}
        </div>
      </section>

      <section class="card">
        <h2>Case notes</h2>
        <NotesField notes={c.notes} onSave={notes => saveField({ notes })} />
      </section>

      <TimerCard c={c} />

      <section class="card">
        <h2>Add time</h2>
        <EntryForm
          key={formKey} today={today()} initial={store.getMeta(draftKey, {})} submitLabel="Add time"
          errors={errors} onDraft={saveDraft} onSubmit={addTime}
        />
      </section>

      <section class="card">
        <h2>Entries ({entries.length})</h2>
        {entries.length === 0
          ? <p class="muted">No time logged yet.</p>
          : (
            <ul class="entries">
              {entries.map(e => (
                <li key={e.id} class="entry">
                  <div class="entry-head">
                    <span class="entry-date">{formatDateLong(e.date)}</span>
                    <span class="entry-time">{formatDurationSeconds(entrySeconds(e))}</span>
                  </div>
                  {e.note && <p class="entry-note">{e.note}</p>}
                  <div class="entry-actions">
                    <button type="button" class="btn small" onClick={() => dialogs.open(({ close }) => <EditEntrySheet caseId={c.id} entry={e} onClose={close} />)}>Edit</button>
                    <button type="button" class="btn small danger" onClick={() => deleteEntry(e)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section class="card actions">
        <a class="btn block" href={routes.calendar({ caseId: c.id })}>View in calendar</a>
        <button type="button" class="btn block" onClick={() => openEditCase(c)}>Edit case</button>
        {c.archived
          ? <button type="button" class="btn block" onClick={() => unarchiveCase(c)}>Unarchive</button>
          : <button type="button" class="btn block" onClick={() => archiveWithUndo(c)}>Archive</button>}
        <button type="button" class="btn block danger" onClick={deleteCase}>Delete case</button>
      </section>
    </Page>
  );
}
