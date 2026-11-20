// Actions on a case that more than one screen offers: archive (with Undo), unarchive, the ⋯ menu,
// new case, edit case. Anything that would put her over 50 active cases goes through LimitSheet.
import { useApp } from '../context/AppContext.jsx';
import { useDialogs } from '../context/Dialogs.jsx';
import { useToast } from '../context/Toast.jsx';
import { EditCaseSheet, LimitSheet, NewCaseSheet } from '../components/CaseSheets.jsx';
import { navigate } from './useRoute.js';
import { routes } from '../../js/router.js';

export function useCaseActions() {
  const { store, guard } = useApp();
  const dialogs = useDialogs();
  const toast = useToast();

  /** Resolves with retry()'s result once there is room, or null if she closed the sheet first. */
  const limitFlow = ({ retry }) => new Promise(resolve => {
    dialogs.open(({ close }) => <LimitSheet retry={retry} onResult={resolve} onClose={close} />);
  });

  async function unarchiveCase(c) {
    let r = await guard(store.unarchive(c.id));
    if (!r) return;
    if (r.reason === 'limit') {
      r = await limitFlow({ retry: () => store.unarchive(c.id) });
      if (!r) return;
    }
    if (r.ok) toast(`Unarchived ${c.displayId}`);
  }

  async function archiveWithUndo(c) {
    const r = await guard(store.archive(c.id));
    if (r) toast(`Archived ${c.displayId}`, { actionLabel: 'Undo', onAction: () => unarchiveCase(c) });
  }

  /** The "⋯" menu: the non-swipe way to archive. */
  function openCaseMenu(c) {
    dialogs.actionSheet({
      title: c.displayId,
      actions: [
        { label: 'Open case', run: () => navigate(routes.caseDetail(c.id)) },
        { label: 'Archive', run: () => archiveWithUndo(c) },
      ],
    });
  }

  const openNewCase = () => dialogs.open(({ close }) => <NewCaseSheet onClose={close} limitFlow={limitFlow} />);
  const openEditCase = c => dialogs.open(({ close }) => <EditCaseSheet caseId={c.id} onClose={close} />);

  return { archiveWithUndo, unarchiveCase, openCaseMenu, openNewCase, openEditCase };
}
