// Shows a tutorial the first time a screen (or sheet) is reached. Flags live in the database.
import { useEffect } from 'preact/hooks';
import { useApp } from '../context/AppContext.jsx';
import { useDialogs } from '../context/Dialogs.jsx';
import { TutorialSheet } from '../components/Sheets.jsx';
import { markSeen, shouldShow } from '../../js/tutorials.js';

/**
 * enabled: wait until true (e.g. the archive tip needs at least one case).
 * over: allowed to open on top of another sheet (the add-a-case tip opens over the form).
 * Otherwise it never stacks on an open sheet; it simply tries again next visit.
 */
export function useTutorial(id, { enabled = true, over = false } = {}) {
  const { store, guard, tutorialsShown } = useApp();
  const dialogs = useDialogs();

  useEffect(() => {
    if (!enabled) return;
    const seen = store.getMeta('tutorialsSeen', {});
    if (!shouldShow(id, seen) || tutorialsShown.has(id)) return;
    if (!over && dialogs.hasOpen()) return;
    tutorialsShown.add(id); // now: the saved flag below lands a moment later
    dialogs.open(({ close }) => <TutorialSheet id={id} onClose={close} />);
    guard(store.setMeta('tutorialsSeen', markSeen(seen, id)));
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function openTutorial(dialogs, id) {
  dialogs.open(({ close }) => <TutorialSheet id={id} onClose={close} />);
}
