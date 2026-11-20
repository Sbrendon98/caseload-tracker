// Archived cases, with Unarchive.
import { useApp } from '../context/AppContext.jsx';
import { Page } from '../components/Page.jsx';
import { useCaseActions } from '../hooks/useCaseActions.jsx';
import { formatDateShort } from '../../js/format.js';
import { todayLocal } from '../../js/dates.js';
import { routes } from '../../js/router.js';
import { formatDuration, totalMinutes } from '../../js/model.js';

export function ArchivedPage() {
  const { store } = useApp();
  const { unarchiveCase } = useCaseActions();
  const cases = store.archivedNewestFirst();

  return (
    <Page title="Archived" back={{ label: 'Cases', href: routes.list() }}>
      {cases.length === 0
        ? <p class="empty">No archived cases. Swipe a case left on the main list to archive it.</p>
        : (
          <ul class="case-list">
            {cases.map(c => (
              <li key={c.id} class="plain-row">
                <a class="case-link" href={routes.caseDetail(c.id)}>
                  <span class="case-id">{c.displayId}</span>
                  <span class="case-meta">Archived {formatDateShort(todayLocal(new Date(c.archivedAt)))}</span>
                  <span class="case-total">{formatDuration(totalMinutes(c.entries))}</span>
                </a>
                <button type="button" class="btn small" aria-label={`Unarchive ${c.displayId}`} onClick={() => unarchiveCase(c)}>
                  Unarchive
                </button>
              </li>
            ))}
          </ul>
        )}
    </Page>
  );
}
