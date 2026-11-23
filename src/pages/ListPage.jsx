// Main screen: active cases, newest first, with search, this-week total and a New case button.
import { useApp } from '../context/AppContext.jsx';
import { Page } from '../components/Page.jsx';
import { SwipeRow } from '../components/SwipeRow.jsx';
import { useCaseActions } from '../hooks/useCaseActions.jsx';
import { useTutorial } from '../hooks/useTutorial.jsx';
import { formatDateShort } from '../../js/format.js';
import { inRange, weekRange } from '../../js/dates.js';
import { routes } from '../../js/router.js';
import { ACTIVE_LIMIT, dueStatus, formatDuration, formatDurationSeconds, matchesSearch, totalMinutes, totalSeconds } from '../../js/model.js';

function CaseLink({ c, today }) {
  const status = dueStatus(c.dueDate, today);
  return (
    <a class="case-link" href={routes.caseDetail(c.id)}>
      <span class="case-id">{c.displayId}</span>
      <span class="case-meta">
        {c.dueDate ? `Due ${formatDateShort(c.dueDate)}` : 'No due date'}
        {status && <span class={`badge ${status}`}>{status === 'overdue' ? 'Overdue' : 'Due soon'}</span>}
      </span>
      <span class="case-total">{formatDurationSeconds(totalSeconds(c.entries))}</span>
    </a>
  );
}

export function ListPage() {
  const { store, today, search, setSearch } = useApp();
  const { archiveWithUndo, openCaseMenu, openNewCase } = useCaseActions();

  const week = weekRange(today(), store.getMeta('weekStart', 0));
  const weekEntries = store.cases().flatMap(c => c.entries).filter(e => inRange(e.date, week));
  const active = store.activeNewestFirst();
  const shown = active.filter(c => matchesSearch(c.displayId, search));
  const archivedCount = store.cases().length - active.length;

  useTutorial('welcome');
  useTutorial('archive', { enabled: active.length > 0 });

  const emptyText = active.length === 0
    ? 'No cases yet. Tap “+ New case” to add your first one.'
    : shown.length === 0 ? 'No cases match your search.' : '';

  return (
    <Page title="Caseload" actions={[{ label: 'Calendar', href: routes.calendar() }, { label: 'Options', href: routes.options() }]}>
      <p class="summary">
        <span>This week: {formatDuration(totalMinutes(weekEntries))}</span>
        <span>{active.length} of {ACTIVE_LIMIT} active</span>
      </p>
      <input
        type="search" class="search" placeholder="Search by ID, e.g. Jane D.-122" value={search}
        aria-label="Search cases by ID" autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck="false"
        onInput={e => setSearch(e.currentTarget.value)}
      />
      <ul class="case-list">
        {shown.map(c => (
          <SwipeRow
            key={c.id} menuLabel={`More actions for ${c.displayId}`}
            onAction={() => archiveWithUndo(c)} onMenu={() => openCaseMenu(c)}
          >
            <CaseLink c={c} today={today()} />
          </SwipeRow>
        ))}
      </ul>
      <p class="empty" hidden={!emptyText}>{emptyText}</p>
      <p class="footer-link"><a href={routes.archived()}>Archived cases ({archivedCount})</a></p>
      <div class="bottom-bar">
        <button type="button" class="btn primary block" onClick={openNewCase}>+ New case</button>
      </div>
    </Page>
  );
}
