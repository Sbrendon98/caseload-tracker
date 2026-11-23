// Start / stop / correct the timer for a case. Stop saves the entry at once; the Saved message
// has an Edit button, and a running timer can have its start time corrected.
import { useEffect, useRef, useState } from 'preact/hooks';
import { useApp } from '../context/AppContext.jsx';
import { Sheet, useDialogs } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { EditEntrySheet } from './EntryList.jsx';
import { formatClock } from '../../js/format.js';
import { fromDateTimeLocal, todayLocal, toDateTimeLocal } from '../../js/dates.js';
import { routes } from '../../js/router.js';
import { entrySeconds, formatDurationSeconds } from '../../js/durations.js';
import { timerStop, validateTimerStart } from '../../js/timer.js';

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

export function TimerCard({ c }) {
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
  }, [running]); // only restart the ticking when the timer starts or stops

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
