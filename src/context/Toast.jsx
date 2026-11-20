// A single message at the bottom of the screen, with an optional action (Undo, Open).
import { createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';

const ToastContext = createContext(null);

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside <ToastProvider>');
  return value;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const dismiss = useCallback(() => { clearTimeout(timer.current); setToast(null); }, []);
  const show = useCallback((message, { actionLabel, onAction, ms = 6000 } = {}) => {
    clearTimeout(timer.current);
    setToast({ message, actionLabel, onAction });
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => show, [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div id="toast-root" aria-live="polite">
        {toast && (
          <div class="toast" role="status">
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button type="button" class="toast-action" onClick={() => { dismiss(); toast.onAction?.(); }}>{toast.actionLabel}</button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
