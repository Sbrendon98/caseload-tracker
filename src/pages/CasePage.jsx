// Case detail: total, due date, notes, timer, add time, entries, and case actions.
import { useApp } from '../context/AppContext.jsx';
import { useDialogs } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { Page } from '../components/Page.jsx';
import { AddTimeCard, entryDraftKey } from '../components/AddTimeCard.jsx';
import { EntryList } from '../components/EntryList.jsx';
import { NotesField } from '../components/NotesField.jsx';
import { TimerCard } from '../components/TimerCard.jsx';
import { useCaseActions } from '../hooks/useCaseActions.jsx';
import { useTutorial } from '../hooks/useTutorial.jsx';
import { navigate } from '../hooks/useRoute.js';
import { routes } from '../../js/router.js';
import { formatDurationSeconds, totalSeconds } from '../../js/durations.js';

export function CasePage({ id }) {
  const { store, guard } = useApp();
  const dialogs = useDialogs();
  const toast = useToast();
  const { archiveWithUndo, unarchiveCase, openEditCase } = useCaseActions();
  const c = store.getCase(id);
  useTutorial('logTime', { enabled: Boolean(c) });

  if (!c) {
    return (
      <Page title="Case not found" back={{ label: 'Cases', href: routes.list() }}>
        <p class="empty">This case no longer exists.</p>
      </Page>
    );
  }

  /** Saves one field of the case (due date or notes) in place. */
  async function saveField(patch) {
    const r = await guard(store.updateCase(c.id, {
      initials: c.initials, caseNumber: c.caseNumber, dueDate: c.dueDate ?? '', notes: c.notes, ...patch,
    }));
    if (r?.ok) toast('Saved', { ms: 1500 });
    else if (r) toast('Could not save that change.');
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
    await guard(store.setMeta(entryDraftKey(c.id), undefined));
    const r = await guard(store.deleteCase(c.id));
    if (r) { navigate(routes.list()); toast(`Deleted ${c.displayId}`); }
  }

  const back = c.archived ? { label: 'Archived', href: routes.archived() } : { label: 'Cases', href: routes.list() };

  return (
    <Page title={c.displayId} back={back}>
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
      <AddTimeCard caseId={c.id} />
      <EntryList caseId={c.id} entries={c.entries} />

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
