// Sheets for creating and editing cases, and the "Archive completed cases" sheet shown when she is
// at 50 active cases. Opened through useCaseActions().
import { useRef, useState } from 'preact/hooks';
import { Sheet } from '../context/Dialogs.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/Toast.jsx';
import { useDebounced } from '../hooks/useDebounced.js';
import { useTutorial } from '../hooks/useTutorial.jsx';
import { navigate } from '../hooks/useRoute.js';
import { CaseForm } from './Forms.jsx';
import { SwipeRow } from './SwipeRow.jsx';
import { formatDateShort } from '../../js/format.js';
import { todayLocal } from '../../js/dates.js';
import { routes } from '../../js/router.js';
import { ACTIVE_LIMIT, activeCount, canAddActive } from '../../js/cases.js';
import { formatDurationSeconds, totalSeconds } from '../../js/durations.js';

const DRAFT_NEW_CASE = 'draft:newCase';

/** New case. Her text is kept as a draft until she saves or cancels. */
export function NewCaseSheet({ onClose, limitFlow }) {
  const { store, guard } = useApp();
  const toast = useToast();
  const [errors, setErrors] = useState({});
  const initial = useRef(store.getMeta(DRAFT_NEW_CASE) ?? {}).current;
  const saveDraft = useDebounced(values => guard(store.setMeta(DRAFT_NEW_CASE, values)));
  useTutorial('addCase', { over: true }); // opens over this form

  const clearDraft = () => { saveDraft.cancel(); return guard(store.setMeta(DRAFT_NEW_CASE, undefined)); };

  return (
    <Sheet title="New case" onClose={onClose}>
      {({ dismiss }) => (
        <CaseForm
          initial={initial} submitLabel="Create case" errors={errors} onDraft={saveDraft}
          onCancel={async () => { await clearDraft(); dismiss(); }}
          onSubmit={async values => {
            saveDraft.cancel();
            let r = await guard(store.addCase(values));
            if (!r) return;
            if (r.reason === 'limit') {
              r = await limitFlow({ retry: () => store.addCase(values) });
              if (!r) return; // she closed the sheet; her form is still filled in
            }
            if (!r.ok) { setErrors(r.errors); return; }
            await clearDraft();
            dismiss();
            toast(`Created ${r.case.displayId}`, { actionLabel: 'Open', onAction: () => navigate(routes.caseDetail(r.case.id)) });
          }}
        />
      )}
    </Sheet>
  );
}

/** Edit the student name / case number / due date / notes. */
export function EditCaseSheet({ caseId, onClose }) {
  const { store, guard } = useApp();
  const toast = useToast();
  const [errors, setErrors] = useState({});
  const current = useRef(store.getCase(caseId)).current;
  return (
    <Sheet title={`Edit ${current.displayId}`} onClose={onClose}>
      {({ dismiss }) => (
        <CaseForm
          initial={current} submitLabel="Save" errors={errors} onCancel={dismiss}
          onSubmit={async values => {
            const r = await guard(store.updateCase(caseId, values));
            if (!r) return;
            if (!r.ok) { setErrors(r.errors ?? {}); return; }
            dismiss();
            toast('Saved');
          }}
        />
      )}
    </Sheet>
  );
}

/**
 * Lists active cases oldest first so she can archive finished ones. Once there is room, the
 * pending action (retry) runs by itself and onResult receives its result; closing the sheet first
 * gives onResult(null).
 */
export function LimitSheet({ retry, onResult, onClose }) {
  const { store, guard } = useApp();
  const settled = useRef(false);
  const active = store.activeOldestFirst();
  const need = activeCount(store.cases()) - (ACTIVE_LIMIT - 1);

  async function archive(c, dismiss) {
    const r = await guard(store.archive(c.id));
    if (!r || !canAddActive(store.cases())) return;
    settled.current = true;
    const result = await guard(retry());
    onResult(result);
    dismiss();
  }

  return (
    <Sheet title="Archive completed cases" onClose={() => { onClose(); if (!settled.current) onResult(null); }}>
      {({ dismiss }) => (
        <div>
          <p>
            You can have up to {ACTIVE_LIMIT} active cases. Archive the ones you have finished to make room.
            Oldest cases are listed first. Swipe a case left and tap Archive, or use its Archive button.
          </p>
          <p class="limit-status" role="status">You have {active.length} active cases. Archive {need} more to continue.</p>
          <ul class="case-list">
            {active.map(c => (
              <SwipeRow key={c.id} menuMode="button" menuLabel={`Archive ${c.displayId}`} onAction={() => archive(c, dismiss)}>
                <div class="case-link">
                  <span class="case-id">{c.displayId}</span>
                  <span class="case-meta">Added {formatDateShort(todayLocal(new Date(c.createdAt)))}</span>
                  <span class="case-total">{formatDurationSeconds(totalSeconds(c.entries))}</span>
                </div>
              </SwipeRow>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  );
}
