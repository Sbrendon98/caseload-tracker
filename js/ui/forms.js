// Case and time-entry forms. They only collect and show values; saving is the caller's job.
import { h } from './dom.js';
import { todayLocal } from '../dates.js';

export const NOTES_PLACEHOLDER =
  'Write any notes needed. For example, notes about any blockers causing delay or any impediments.';

function field(labelText, input) {
  const error = h('span', { class: 'field-error', role: 'alert', hidden: true });
  return {
    input, error,
    el: h('label', { class: 'field' }, h('span', { class: 'label' }, labelText), input, error),
    show(message) { error.textContent = message ?? ''; error.hidden = !message; },
  };
}

function formError() {
  return h('p', { class: 'form-error', role: 'alert', hidden: true });
}
function showFormError(el, message) { el.textContent = message ?? ''; el.hidden = !message; }

/** onDraft(values) fires on every edit so the caller can save a draft. */
export function caseForm({ initial = {}, submitLabel, onSubmit, onCancel, onDraft }) {
  const initials = field('Initials', h('input', {
    type: 'text', value: initial.initials ?? '', placeholder: 'e.g. A S', autocomplete: 'off',
    autocapitalize: 'characters', autocorrect: 'off', spellcheck: false, required: true, maxLength: 12,
  }));
  const caseNumber = field('Case number', h('input', {
    type: 'text', value: initial.caseNumber ?? '', placeholder: 'Letters and numbers', autocomplete: 'off',
    autocapitalize: 'none', autocorrect: 'off', spellcheck: false, inputMode: 'text', required: true,
  }));
  const dueDate = field('Due date (optional)', h('input', { type: 'date', value: initial.dueDate ?? '' }));
  const notes = field('Case notes (optional)', h('textarea', {
    rows: 4, value: initial.notes ?? '', placeholder: NOTES_PLACEHOLDER,
  }));
  const failure = formError();
  const fields = { initials, caseNumber, dueDate, notes };
  const values = () => ({
    initials: initials.input.value, caseNumber: caseNumber.input.value,
    dueDate: dueDate.input.value, notes: notes.input.value,
  });

  const el = h('form', { class: 'form', novalidate: true, onSubmit: e => { e.preventDefault(); onSubmit(values()); } },
    initials.el, caseNumber.el, dueDate.el, notes.el, failure,
    h('div', { class: 'button-row' },
      h('button', { type: 'button', class: 'btn', onClick: onCancel }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary' }, submitLabel)));
  if (onDraft) el.addEventListener('input', () => onDraft(values()));

  return {
    el,
    values,
    focus: () => initials.input.focus(),
    /** errors: the `errors` object from validateCase. */
    setErrors(errors = {}) {
      for (const [key, f] of Object.entries(fields)) f.show(errors[key]);
      showFormError(failure, errors.duplicate);
    },
  };
}

const CHIPS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '45 min', minutes: 45 },
  { label: '1 hr', minutes: 60 },
  { label: '1.5 hr', minutes: 90 },
];

export function entryForm({ initial = {}, submitLabel, onSubmit, onCancel, onDraft }) {
  const date = field('Date', h('input', { type: 'date', value: initial.date || todayLocal(), required: true }));
  const hours = field('Hours', h('input', {
    type: 'text', inputMode: 'numeric', pattern: '[0-9]*', value: initial.hours ?? '', placeholder: '0', autocomplete: 'off',
  }));
  const minutes = field('Minutes', h('input', {
    type: 'text', inputMode: 'numeric', pattern: '[0-9]*', value: initial.minutes ?? '', placeholder: '0', autocomplete: 'off',
  }));
  const note = field('Note (optional)', h('textarea', { rows: 2, value: initial.note ?? '', placeholder: 'What did you work on?' }));
  const failure = formError();
  const fields = { date, hours, minutes, note };
  const values = () => ({
    date: date.input.value, hours: hours.input.value, minutes: minutes.input.value, note: note.input.value,
  });

  const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Quick durations' },
    CHIPS.map(c => h('button', {
      type: 'button', class: 'chip',
      onClick: () => {
        hours.input.value = String(Math.floor(c.minutes / 60));
        minutes.input.value = String(c.minutes % 60);
        onDraft?.(values());
      },
    }, c.label)));

  const el = h('form', { class: 'form', novalidate: true, onSubmit: e => { e.preventDefault(); onSubmit(values()); } },
    date.el, chips,
    h('div', { class: 'row-2' }, hours.el, minutes.el),
    note.el, failure,
    h('div', { class: 'button-row' },
      onCancel && h('button', { type: 'button', class: 'btn', onClick: onCancel }, 'Cancel'),
      h('button', { type: 'submit', class: 'btn primary' }, submitLabel)));
  if (onDraft) el.addEventListener('input', () => onDraft(values()));

  return {
    el,
    values,
    /** errors: the `errors` object from validateEntry. */
    setErrors(errors = {}) {
      for (const [key, f] of Object.entries(fields)) f.show(errors[key]);
      showFormError(failure, errors.total);
    },
  };
}

/** Saves a draft after the user pauses typing; flush() writes immediately. */
export function debounced(fn, ms = 400) {
  let timer = null;
  const wrapper = (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  wrapper.cancel = () => clearTimeout(timer);
  return wrapper;
}
