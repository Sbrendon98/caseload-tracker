// Sheets for creating and editing a case. Opened through useCaseActions().
import { useRef, useState } from 'preact/hooks';
import { Sheet } from '../context/Dialogs.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/Toast.jsx';
import { useDebounced } from '../hooks/useDebounced.js';
import { useTutorial } from '../hooks/useTutorial.jsx';
import { navigate } from '../hooks/useRoute.js';
import { CaseForm } from './Forms.jsx';
import { routes } from '../../js/router.js';

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
