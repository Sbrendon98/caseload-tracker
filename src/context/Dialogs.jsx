// Sheets built on <dialog> (focus trap, Escape to close and an inert background come for free).
// dialogs.open(render) shows a sheet; render({ close }) returns the sheet's content.
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';

const DialogsContext = createContext(null);

export function useDialogs() {
  const value = useContext(DialogsContext);
  if (!value) throw new Error('useDialogs must be used inside <DialogsProvider>');
  return value;
}

let sheetCounter = 0;

/**
 * A modal sheet. onClose runs once, however it ends: Close button, Escape, or being removed.
 * children may be a function receiving { dismiss } to close the sheet from inside.
 */
export function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  const latestOnClose = useRef(onClose);
  latestOnClose.current = onClose;
  const titleId = useRef(`sheet-title-${++sheetCounter}`).current;

  useEffect(() => {
    const el = ref.current;
    let finished = false;
    const finish = () => { if (!finished) { finished = true; latestOnClose.current?.(); } };
    el.addEventListener('close', finish);
    if (!el.open) el.showModal();
    return () => { el.removeEventListener('close', finish); finish(); };
  }, []);

  const dismiss = () => { if (ref.current?.open) ref.current.close(); };
  return (
    <dialog ref={ref} class="sheet" aria-labelledby={titleId}>
      <div class="sheet-head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" class="icon-btn" aria-label="Close" onClick={dismiss}>✕</button>
      </div>
      <div class="sheet-body">{typeof children === 'function' ? children({ dismiss }) : children}</div>
    </dialog>
  );
}

export function DialogsProvider({ children }) {
  const [stack, setStack] = useState([]);
  const stackRef = useRef([]);
  const nextId = useRef(0);

  const update = useCallback(fn => {
    stackRef.current = fn(stackRef.current);
    setStack(stackRef.current);
  }, []);
  const close = useCallback(id => update(s => s.filter(d => d.id !== id)), [update]);

  const api = useMemo(() => ({
    open(render) {
      const id = ++nextId.current;
      update(s => [...s, { id, render }]);
      return { close: () => close(id) };
    },
    /** True while any sheet is open (counts sheets opened a moment ago that have not rendered yet). */
    hasOpen: () => stackRef.current.length > 0,
    /** Resolves true only when the confirm button is pressed. */
    confirm({ title, message, confirmLabel = 'Confirm', danger = false }) {
      return new Promise(resolve => {
        let answer = false;
        api.open(({ close: remove }) => (
          <Sheet title={title} onClose={() => { remove(); resolve(answer); }}>
            {({ dismiss }) => (
              <div>
                <p>{message}</p>
                <div class="button-row">
                  <button type="button" class="btn" onClick={dismiss}>Cancel</button>
                  <button type="button" class={`btn ${danger ? 'danger' : 'primary'}`} onClick={() => { answer = true; dismiss(); }}>{confirmLabel}</button>
                </div>
              </div>
            )}
          </Sheet>
        ));
      });
    },
    /** A sheet of stacked action buttons: [{ label, danger?, run }]. */
    actionSheet({ title, actions }) {
      api.open(({ close: remove }) => (
        <Sheet title={title} onClose={remove}>
          {({ dismiss }) => (
            <div class="action-list">
              {actions.map(a => (
                <button key={a.label} type="button" class={`btn block ${a.danger ? 'danger' : ''}`} onClick={() => { dismiss(); a.run(); }}>{a.label}</button>
              ))}
              <button type="button" class="btn block" onClick={dismiss}>Cancel</button>
            </div>
          )}
        </Sheet>
      ));
    },
  }), [update, close]);

  return (
    <DialogsContext.Provider value={api}>
      {children}
      <div id="modal-root">
        {stack.map(d => <div key={d.id}>{d.render({ close: () => close(d.id) })}</div>)}
      </div>
    </DialogsContext.Provider>
  );
}
