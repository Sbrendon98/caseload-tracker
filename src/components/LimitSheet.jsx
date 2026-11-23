// The "Archive completed cases" sheet shown when she is at 50 active cases.
import { useRef } from 'preact/hooks';
import { Sheet } from '../context/Dialogs.jsx';
import { useApp } from '../context/AppContext.jsx';
import { SwipeRow } from './SwipeRow.jsx';
import { formatDateShort } from '../../js/format.js';
import { todayLocal } from '../../js/dates.js';
import { ACTIVE_LIMIT, activeCount, canAddActive } from '../../js/cases.js';
import { formatDurationSeconds, totalSeconds } from '../../js/durations.js';

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
