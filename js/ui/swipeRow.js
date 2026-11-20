// A list row that reveals an action when swiped left. The swipe is a shortcut only: every row also
// has a visible control (a "⋯" menu, or a labelled button) so nothing depends on the gesture.
import { h } from './dom.js';
import { attachSwipe } from '../swipe.js';

/**
 * content: element for the row body.
 * onAction: the swipe-revealed action (e.g. Archive).
 * menuMode 'menu': a "⋯" button calling onMenu. menuMode 'button': a visible button calling onAction.
 */
export function swipeRow({ content, actionLabel = 'Archive', onAction, menuMode = 'menu', menuLabel, onMenu }) {
  const action = h('button', {
    type: 'button', class: 'swipe-action', tabIndex: -1, 'aria-hidden': 'true', onClick: onAction,
  }, actionLabel);

  const trigger = menuMode === 'button'
    ? h('button', { type: 'button', class: 'btn small', 'aria-label': menuLabel, onClick: onAction }, actionLabel)
    : h('button', { type: 'button', class: 'menu-btn', 'aria-label': menuLabel, 'aria-haspopup': 'dialog', onClick: onMenu }, '⋯');

  const body = h('div', { class: 'swipe-content' }, content, trigger);
  attachSwipe(body, {
    onOpenChange: open => {
      action.tabIndex = open ? 0 : -1;
      action.setAttribute('aria-hidden', String(!open));
    },
  });
  return h('li', { class: 'swipe-row' }, action, body);
}
