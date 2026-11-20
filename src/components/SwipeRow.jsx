// A list row that reveals an action when swiped left. The swipe is a shortcut only: every row also
// has a visible control (a "⋯" menu, or a labelled button) so nothing depends on the gesture.
// The gesture itself is js/swipe.js (maths unit tested); this component wires it to a row.
import { useEffect, useRef, useState } from 'preact/hooks';
import { attachSwipe } from '../../js/swipe.js';

/**
 * onAction: the swipe-revealed action (e.g. Archive).
 * menuMode 'menu': a "⋯" button calling onMenu. menuMode 'button': a visible button calling onAction.
 */
export function SwipeRow({ children, actionLabel = 'Archive', onAction, menuMode = 'menu', menuLabel, onMenu }) {
  const body = useRef(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const swipe = attachSwipe(body.current, { onOpenChange: setOpen });
    return () => swipe.close();
  }, []);

  return (
    <li class="swipe-row">
      <button type="button" class="swipe-action" tabIndex={open ? 0 : -1} aria-hidden={!open} onClick={onAction}>
        {actionLabel}
      </button>
      <div class="swipe-content" ref={body}>
        {children}
        {menuMode === 'button'
          ? <button type="button" class="btn small" aria-label={menuLabel} onClick={onAction}>{actionLabel}</button>
          : <button type="button" class="menu-btn" aria-label={menuLabel} aria-haspopup="dialog" onClick={onMenu}>⋯</button>}
      </div>
    </li>
  );
}
