// Case detail: total, due date, notes, timer, add time, entries, and case actions.
import { useEffect, useState } from 'preact/hooks';
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
import { todayLocal } from '../../js/dates.js';
import { routes } from '../../js/router.js';
import { elapsedMinutes, formatDuration, totalMinutes, validateEntry } from '../../js/model.js';

const MAX_TIMER_MINUTES = 24 * 60;

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

function TimerCard({ c, draftKey, onPrefilled }) {
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

  const start = () => guard(store.setMeta('timer', { caseId: c.id, startedAt: now() }));
  async function discard() {
    const ok = await dialogs.confirm({ title: 'Discard timer?', message: 'The running time will not be saved.', confirmLabel: 'Discard', danger: true });
    if (ok) await guard(store.setMeta('timer', undefined));
  }
  async function stop() {
    const minutes = Math.min(MAX_TIMER_MINUTES, elapsedMinutes(timer.startedAt, now()));
    await guard(store.setMeta(draftKey, {
      ...store.getMeta(draftKey, {}),
      date: todayLocal(new Date(timer.startedAt)),
      hours: String(Math.floor(minutes / 60)),
      minutes: String(minutes % 60),
    }));
    await guard(store.setMeta('timer', undefined));
    onPrefilled();
    toast('Check the time below, then tap Add time.');
  }

  if (running) {
    return (
      <section class="card">
        <h2>Timer running</h2>
        <p class="clock">{formatClock(tick - timer.startedAt)}</p>
        <div class="button-row">
          <button type="button" class="btn" onClick={discard}>Discard</button>
          <button type="button" class="btn primary" onClick={stop}>Stop and fill in time</button>
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
            const r = await guard(store.updateEntry(caseId, entry.id, values));
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
      toast(`Added ${formatDuration(r.entry.minutes)}`, { ms: 2500 });
      setFormKey(k => k + 1);
    }
  }

  async function deleteEntry(entry) {
    const ok = await dialogs.confirm({
      title: 'Delete this entry?',
      message: `${formatDateLong(entry.date)}, ${formatDuration(entry.minutes)}. This cannot be undone.`,
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
        <p class="total">{formatDuration(totalMinutes(c.entries))}</p>
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

      <TimerCard c={c} draftKey={draftKey} onPrefilled={() => setFormKey(k => k + 1)} />

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
                    <span class="entry-time">{formatDuration(e.minutes)}</span>
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
