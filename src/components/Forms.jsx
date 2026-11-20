// Case and time-entry forms. They collect and show values; saving is the caller's job.
// iOS details: font-size 16px (in CSS) stops zoom-on-focus; attribute spellings like autoCorrect and
// spellCheck are deliberate, so Preact sets real attributes rather than Safari's boolean properties.
import { useEffect, useRef, useState } from 'preact/hooks';

export const NOTES_PLACEHOLDER =
  'Write any notes needed. For example, notes about any blockers causing delay or any impediments.';

function Field({ label, error, children }) {
  return (
    <label class="field">
      <span class="label">{label}</span>
      {children}
      <span class="field-error" role="alert" hidden={!error}>{error}</span>
    </label>
  );
}

/** onDraft(values) fires on every edit so the caller can save a draft. errors comes from validateCase. */
export function CaseForm({ initial = {}, submitLabel, onSubmit, onCancel, onDraft, errors = {} }) {
  const [values, setValues] = useState({
    initials: initial.initials ?? '', caseNumber: initial.caseNumber ?? '',
    dueDate: initial.dueDate ?? '', notes: initial.notes ?? '',
  });
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);

  const edit = key => e => {
    const next = { ...values, [key]: e.currentTarget.value };
    setValues(next);
    onDraft?.(next);
  };

  return (
    <form class="form" noValidate onSubmit={e => { e.preventDefault(); onSubmit(values); }}>
      <Field label="Student (first name and last initial, or initials)" error={errors.initials}>
        <input
          ref={first} type="text" value={values.initials} onInput={edit('initials')} placeholder="Jane D. or J.D"
          autoComplete="off" autoCapitalize="words" autoCorrect="off" spellCheck="false" required maxLength={30}
        />
      </Field>
      <Field label="Case number (up to 10 letters or numbers)" error={errors.caseNumber}>
        <input
          type="text" value={values.caseNumber} onInput={edit('caseNumber')} placeholder="122445543"
          autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck="false" inputMode="text" required maxLength={10}
        />
      </Field>
      <Field label="Due date (optional)" error={errors.dueDate}>
        <input type="date" value={values.dueDate} onInput={edit('dueDate')} />
      </Field>
      <Field label="Case notes (optional)" error={errors.notes}>
        <textarea rows={4} value={values.notes} onInput={edit('notes')} placeholder={NOTES_PLACEHOLDER} />
      </Field>
      <p class="form-error" role="alert" hidden={!errors.duplicate}>{errors.duplicate}</p>
      <div class="button-row">
        <button type="button" class="btn" onClick={onCancel}>Cancel</button>
        <button type="submit" class="btn primary">{submitLabel}</button>
      </div>
    </form>
  );
}

const CHIPS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hr', minutes: 60 },
  { label: '1.5 hr', minutes: 90 },
];

/** errors comes from validateEntry. today is the default date for a new entry. */
export function EntryForm({ initial = {}, today, submitLabel, onSubmit, onCancel, onDraft, errors = {} }) {
  const [values, setValues] = useState({
    date: initial.date || today, hours: initial.hours ?? '', minutes: initial.minutes ?? '', note: initial.note ?? '',
  });
  const update = next => { setValues(next); onDraft?.(next); };
  const edit = key => e => update({ ...values, [key]: e.currentTarget.value });
  const chip = total => update({ ...values, hours: String(Math.floor(total / 60)), minutes: String(total % 60) });

  return (
    <form class="form" noValidate onSubmit={e => { e.preventDefault(); onSubmit(values); }}>
      <Field label="Date" error={errors.date}>
        <input type="date" value={values.date} onInput={edit('date')} required />
      </Field>
      <div class="chips" role="group" aria-label="Quick durations">
        {CHIPS.map(c => <button key={c.label} type="button" class="chip" onClick={() => chip(c.minutes)}>{c.label}</button>)}
      </div>
      <div class="row-2">
        <Field label="Hours" error={errors.hours}>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={values.hours} onInput={edit('hours')} placeholder="0" autoComplete="off" />
        </Field>
        <Field label="Minutes" error={errors.minutes}>
          <input type="text" inputMode="numeric" pattern="[0-9]*" value={values.minutes} onInput={edit('minutes')} placeholder="0" autoComplete="off" />
        </Field>
      </div>
      <Field label="Note (optional)" error={errors.note}>
        <textarea rows={2} value={values.note} onInput={edit('note')} placeholder="What did you work on?" />
      </Field>
      <p class="form-error" role="alert" hidden={!errors.total}>{errors.total}</p>
      <div class="button-row">
        {onCancel && <button type="button" class="btn" onClick={onCancel}>Cancel</button>}
        <button type="submit" class="btn primary">{submitLabel}</button>
      </div>
    </form>
  );
}
