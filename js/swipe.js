// Swipe-left-to-reveal for list rows. The maths is pure and unit tested; attachSwipe wires it to
// pointer events. The row content must have CSS `touch-action: pan-y` so vertical scrolling stays
// with the browser and horizontal drags arrive here.

export const OPEN_WIDTH = 96;
const LOCK_THRESHOLD = 8;      // px of movement before we decide scroll vs swipe
const FLICK_VELOCITY = 0.5;    // px per ms

/** null until the finger has moved enough; then 'x' (swipe) or 'y' (scroll). Ties favour scrolling. */
export function directionLock(dx, dy) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_THRESHOLD) return null;
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/** Offsets are <= 0 (content slides left); never past fully open. */
export const clampOffset = (value, openWidth) => Math.min(0, Math.max(-openWidth, value));

/** Where the row rests after release. velocityX is px/ms, negative = leftwards. */
export function settle({ offset, velocityX, openWidth }) {
  if (velocityX <= -FLICK_VELOCITY) return 'open';
  if (velocityX >= FLICK_VELOCITY) return 'closed';
  return offset <= -openWidth / 2 ? 'open' : 'closed';
}

let openRow = null;

/** Returns { close, isOpen }. Only one row stays open at a time. */
export function attachSwipe(content, { openWidth = OPEN_WIDTH, onOpenChange = () => {} } = {}) {
  let offset = 0;
  let open = false;
  let pointerId = null;
  let startX = 0, startY = 0, startOffset = 0, lastX = 0, lastT = 0, velocity = 0;
  let lock = null;
  let dragged = false;

  const render = animate => {
    content.style.transition = animate ? 'transform 180ms ease-out' : 'none';
    content.style.transform = offset === 0 ? '' : `translateX(${offset}px)`;
  };
  const setOpen = (next, animate = true) => {
    offset = next ? -openWidth : 0;
    if (open !== next) { open = next; onOpenChange(next); }
    render(animate);
    if (next) openRow = api; else if (openRow === api) openRow = null;
  };
  const api = { close: () => setOpen(false), isOpen: () => open };

  content.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (openRow && openRow !== api) openRow.close();
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = e.clientY;
    startOffset = offset;
    lastT = e.timeStamp;
    velocity = 0;
    lock = null;
    dragged = false;
  });

  content.addEventListener('pointermove', e => {
    if (e.pointerId !== pointerId) return;
    if (lock === null) {
      lock = directionLock(e.clientX - startX, e.clientY - startY);
      if (lock === 'y') { pointerId = null; return; }
      if (lock === 'x') { content.setPointerCapture(e.pointerId); dragged = true; }
    }
    if (lock !== 'x') return;
    offset = clampOffset(startOffset + (e.clientX - startX), openWidth);
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = (e.clientX - lastX) / dt;
    lastX = e.clientX;
    lastT = e.timeStamp;
    render(false);
  });

  const release = e => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    if (lock !== 'x') return;
    setOpen(settle({ offset, velocityX: velocity, openWidth }) === 'open');
  };
  content.addEventListener('pointerup', release);
  content.addEventListener('pointercancel', release);

  // A drag must not count as a tap; a tap on an open row only closes it.
  content.addEventListener('click', e => {
    if (dragged) { dragged = false; e.preventDefault(); e.stopPropagation(); return; }
    if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
  }, true);

  return api;
}
