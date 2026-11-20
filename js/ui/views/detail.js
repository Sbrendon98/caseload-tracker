// Case detail: total, due date, notes, timer, add time, entries, and case actions.
import { h } from '../dom.js';
import { page } from '../layout.js';
import { routes } from '../router.js';
import { openModal, confirmDialog, showToast } from '../modal.js';
import { entryForm, debounced, NOTES_PLACEHOLDER } from '../forms.js';
import { archiveWithUndo, unarchiveCase, openEditCase } from '../caseActions.js';
import { formatDateLong, formatClock } from '../format.js';
import { todayLocal } from '../../dates.js';
import { elapsedMinutes, formatDuration, totalMinutes, validateEntry } from '../../model.js';

const MAX_TIMER_MINUTES = 24 * 60;

export function detailView(ctx, route) {
  const { store } = ctx;
  const c = store.getCase(route.params.id);
  if (!c) {
    return { el: page(ctx, { title: 'Case not found', back: { label: 'Cases', href: routes.list() } },
      h('p', { class: 'empty' }, 'This case no longer exists.')) };
  }

  const draftKey = `draft:entry:${c.id}`;
  let tick = null;

  // ---- case fields saved in place ----
  const saveField = async patch => {
    const r = await ctx.guard(store.updateCase(c.id, {
      initials: c.initials, caseNumber: c.caseNumber, dueDate: c.dueDate ?? '', notes: c.notes, ...patch,
    }));
    if (r?.ok) showToast('Saved', { ms: 1500 });
    else if (r) showToast('Could not save that change.');
  };

  const dueInput = h('input', {
    type: 'date', value: c.dueDate ?? '', 'aria-label': 'Due date',
    onChange: e => saveField({ dueDate: e.target.value }),
  });
  const dueRow = h('div', { class: 'row-inline' },
    h('label', { class: 'label' }, 'Due date', dueInput),
    c.dueDate && h('button', { type: 'button', class: 'btn small', onClick: () => saveField({ dueDate: '' }) }, 'Clear'));

  const notes = h('textarea', {
    rows: 4, value: c.notes, placeholder: NOTES_PLACEHOLDER, 'aria-label': 'Case notes',
    onChange: e => saveField({ notes: e.target.value }),
  });

  // ---- timer ----
  const timer = store.getMeta('timer');
  function timerCard() {
    if (timer && timer.caseId === c.id) {
      const clock = h('p', { class: 'clock' }, formatClock(ctx.now() - timer.startedAt));
      tick = setInterval(() => { clock.textContent = formatClock(ctx.now() - timer.startedAt); }, 1000);
      return h('section', { class: 'card' },
        h('h2', {}, 'Timer running'), clock,
        h('div', { class: 'button-row' },
          h('button', { type: 'button', class: 'btn', onClick: discardTimer }, 'Discard'),
          h('button', { type: 'button', class: 'btn primary', onClick: stopTimer }, 'Stop and fill in time')));
    }
    const other = timer && store.getCase(timer.caseId);
    return h('section', { class: 'card' },
      h('h2', {}, 'Timer'),
      other
        ? h('p', { class: 'muted' }, 'A timer is already running for ', h('a', { href: routes.caseDetail(other.id) }, other.displayId), '.')
        : h('button', { type: 'button', class: 'btn block', onClick: startTimer }, 'Start timer'));
  }
  async function startTimer() {
    if (await ctx.guard(store.setMeta('timer', { caseId: c.id, startedAt: ctx.now() })) !== null) ctx.rerender();
  }
  async function discardTimer() {
    if (!await confirmDialog({ title: 'Discard timer?', message: 'The running time will not be saved.', confirmLabel: 'Discard', danger: true })) return;
    await ctx.guard(store.setMeta('timer', undefined));
    ctx.rerender();
  }
  async function stopTimer() {
    const minutes = Math.min(MAX_TIMER_MINUTES, elapsedMinutes(timer.startedAt, ctx.now()));
    const draft = {
      ...store.getMeta(draftKey, {}),
      date: todayLocal(new Date(timer.startedAt)),
      hours: String(Math.floor(minutes / 60)),
      minutes: String(minutes % 60),
    };
    await ctx.guard(store.setMeta(draftKey, draft));
    await ctx.guard(store.setMeta('timer', undefined));
    ctx.rerender();
    showToast('Check the time below, then tap Add time.');
  }

  // ---- add time ----
  const saveDraft = debounced(values => ctx.guard(store.setMeta(draftKey, values)));
  const addForm = entryForm({
    initial: store.getMeta(draftKey, {}),
    submitLabel: 'Add time',
    onDraft: saveDraft,
    onSubmit: async values => {
      saveDraft.cancel();
      const check = validateEntry(values);
      if (!check.ok) { addForm.setErrors(check.errors); return; }
      // Clear the draft first: adding the entry re-renders this screen, which re-reads the draft.
      if (await ctx.guard(store.setMeta(draftKey, undefined)) === null) return;
      const r = await ctx.guard(store.addEntry(c.id, values));
      if (r?.ok) showToast(`Added ${formatDuration(r.entry.minutes)}`, { ms: 2500 });
    },
  });

  // ---- entries ----
  const entries = [...c.entries].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);

  function editEntry(entry) {
    let modal;
    const form = entryForm({
      initial: { date: entry.date, hours: String(Math.floor(entry.minutes / 60)), minutes: String(entry.minutes % 60), note: entry.note },
      submitLabel: 'Save',
      onCancel: () => modal.close(),
      onSubmit: async values => {
        const r = await ctx.guard(store.updateEntry(c.id, entry.id, values));
        if (!r) return;
        if (!r.ok) { form.setErrors(r.errors ?? {}); return; }
        modal.close();
        showToast('Saved', { ms: 1500 });
      },
    });
    modal = openModal({ title: 'Edit time entry', content: form.el });
  }

  async function deleteEntry(entry) {
    const ok = await confirmDialog({
      title: 'Delete this entry?',
      message: `${formatDateLong(entry.date)}, ${formatDuration(entry.minutes)}. This cannot be undone.`,
      confirmLabel: 'Delete', danger: true,
    });
    if (ok) await ctx.guard(store.deleteEntry(c.id, entry.id));
  }

  async function deleteCase() {
    const n = c.entries.length;
    const ok = await confirmDialog({
      title: `Delete ${c.displayId}?`,
      message: `This also deletes its ${n} time ${n === 1 ? 'entry' : 'entries'}. This cannot be undone.`,
      confirmLabel: 'Delete case', danger: true,
    });
    if (!ok) return;
    if (timer?.caseId === c.id) await ctx.guard(store.setMeta('timer', undefined));
    await ctx.guard(store.setMeta(draftKey, undefined));
    const r = await ctx.guard(store.deleteCase(c.id));
    if (r) { ctx.navigate(routes.list()); showToast(`Deleted ${c.displayId}`); }
  }

  const entryRows = entries.map(e => h('li', { class: 'entry' },
    h('div', { class: 'entry-head' },
      h('span', { class: 'entry-date' }, formatDateLong(e.date)),
      h('span', { class: 'entry-time' }, formatDuration(e.minutes))),
    e.note && h('p', { class: 'entry-note' }, e.note),
    h('div', { class: 'entry-actions' },
      h('button', { type: 'button', class: 'btn small', onClick: () => editEntry(e) }, 'Edit'),
      h('button', { type: 'button', class: 'btn small danger', onClick: () => deleteEntry(e) }, 'Delete'))));

  const el = page(ctx, {
    title: c.displayId,
    back: c.archived ? { label: 'Archived', href: routes.archived() } : { label: 'Cases', href: routes.list() },
  },
    h('section', { class: 'card' },
      h('p', { class: 'total-label' }, c.archived ? 'Archived · total time' : 'Total time'),
      h('p', { class: 'total' }, formatDuration(totalMinutes(c.entries))),
      dueRow),
    h('section', { class: 'card' }, h('h2', {}, 'Case notes'), notes),
    timerCard(),
    h('section', { class: 'card' }, h('h2', {}, 'Add time'), addForm.el),
    h('section', { class: 'card' },
      h('h2', {}, `Entries (${entries.length})`),
      entries.length === 0 ? h('p', { class: 'muted' }, 'No time logged yet.') : h('ul', { class: 'entries' }, entryRows)),
    h('section', { class: 'card actions' },
      h('a', { class: 'btn block', href: routes.calendar({ caseId: c.id }) }, 'View in calendar'),
      h('button', { type: 'button', class: 'btn block', onClick: () => openEditCase(ctx, c) }, 'Edit case'),
      c.archived
        ? h('button', { type: 'button', class: 'btn block', onClick: () => unarchiveCase(ctx, c) }, 'Unarchive')
        : h('button', { type: 'button', class: 'btn block', onClick: () => archiveWithUndo(ctx, c) }, 'Archive'),
      h('button', { type: 'button', class: 'btn block danger', onClick: deleteCase }, 'Delete case')));

  showTutorialOnce(ctx, 'logTime');
  return { el, destroy: () => clearInterval(tick) };
}
