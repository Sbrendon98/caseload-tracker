// Actions on a case that more than one screen offers.
import { openModal, actionSheet, showToast } from './modal.js';
import { showTutorialOnce } from './tutorials.js';
import { limitFlow } from './limit.js';
import { routes } from './router.js';
import { caseForm, debounced } from './forms.js';

export async function unarchiveCase(ctx, c) {
  let r = await ctx.guard(ctx.store.unarchive(c.id));
  if (!r) return;
  if (r.reason === 'limit') {
    r = await limitFlow(ctx, { retry: () => ctx.store.unarchive(c.id) });
    if (!r) return; // she closed the sheet without making room
  }
  if (r.ok) showToast(`Unarchived ${c.displayId}`);
}

export async function archiveWithUndo(ctx, c) {
  const r = await ctx.guard(ctx.store.archive(c.id));
  if (!r) return;
  showToast(`Archived ${c.displayId}`, { actionLabel: 'Undo', onAction: () => unarchiveCase(ctx, c) });
}

/** The "⋯" menu: the non-swipe way to archive. */
export function openCaseMenu(ctx, c) {
  actionSheet({
    title: c.displayId,
    actions: [
      { label: 'Open case', run: () => ctx.navigate(routes.caseDetail(c.id)) },
      { label: 'Archive', run: () => archiveWithUndo(ctx, c) },
    ],
  });
}

const DRAFT_NEW_CASE = 'draft:newCase';

/** New case sheet. Its text is kept as a draft until she saves or cancels. */
export function openNewCase(ctx) {
  const saveDraft = debounced(values => ctx.guard(ctx.store.setMeta(DRAFT_NEW_CASE, values)));
  const clearDraft = () => { saveDraft.cancel(); return ctx.guard(ctx.store.setMeta(DRAFT_NEW_CASE, undefined)); };
  let modal;
  const form = caseForm({
    initial: ctx.store.getMeta(DRAFT_NEW_CASE) ?? {},
    submitLabel: 'Create case',
    onDraft: saveDraft,
    onCancel: async () => { await clearDraft(); modal.close(); },
    onSubmit: async values => {
      saveDraft.cancel();
      let r = await ctx.guard(ctx.store.addCase(values));
      if (!r) return;
      if (r.reason === 'limit') {
        r = await limitFlow(ctx, { retry: () => ctx.store.addCase(values) });
        if (!r) return; // closed the sheet; her form is still filled in
      }
      if (!r.ok) { form.setErrors(r.errors); return; }
      await clearDraft();
      modal.close();
      showToast(`Created ${r.case.displayId}`, { actionLabel: 'Open', onAction: () => ctx.navigate(routes.caseDetail(r.case.id)) });
    },
  });
  modal = openModal({ title: 'New case', content: form.el });
  showTutorialOnce(ctx, 'addCase');
  form.focus();
}

/** Edit initials / case number / due date / notes. */
export function openEditCase(ctx, c) {
  let modal;
  const form = caseForm({
    initial: c,
    submitLabel: 'Save',
    onCancel: () => modal.close(),
    onSubmit: async values => {
      const r = await ctx.guard(ctx.store.updateCase(c.id, values));
      if (!r) return;
      if (!r.ok) { form.setErrors(r.errors ?? {}); return; }
      modal.close();
      showToast('Saved');
    },
  });
  modal = openModal({ title: `Edit ${c.displayId}`, content: form.el });
}
