// The "Add time" form. What she has typed is kept as a draft per case, so leaving the page loses nothing.
import { useState } from 'preact/hooks';
import { useApp } from '../context/AppContext.jsx';
import { useToast } from '../context/Toast.jsx';
import { useDebounced } from '../hooks/useDebounced.js';
import { EntryForm } from './Forms.jsx';
import { entrySeconds, formatDurationSeconds } from '../../js/durations.js';
import { validateEntry } from '../../js/entries.js';

export const entryDraftKey = caseId => `draft:entry:${caseId}`;

export function AddTimeCard({ caseId }) {
  const { store, today, guard } = useApp();
  const toast = useToast();
  const [formKey, setFormKey] = useState(0); // a new key rebuilds the form, emptying it
  const [errors, setErrors] = useState({});
  const draftKey = entryDraftKey(caseId);
  const saveDraft = useDebounced(values => guard(store.setMeta(draftKey, values)));

  async function addTime(values) {
    saveDraft.cancel();
    const check = validateEntry(values);
    setErrors(check.ok ? {} : check.errors);
    if (!check.ok) return;
    // Clear the draft first: the rebuilt form re-reads it.
    if (await guard(store.setMeta(draftKey, undefined)) === null) return;
    const r = await guard(store.addEntry(caseId, values));
    if (r?.ok) {
      toast(`Added ${formatDurationSeconds(entrySeconds(r.entry))}`, { ms: 2500 });
      setFormKey(k => k + 1);
    }
  }

  return (
    <section class="card">
      <h2>Add time</h2>
      <EntryForm
        key={formKey} today={today()} initial={store.getMeta(draftKey, {})} submitLabel="Add time"
        errors={errors} onDraft={saveDraft} onSubmit={addTime}
      />
    </section>
  );
}
