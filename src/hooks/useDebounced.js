import { useCallback, useRef } from 'preact/hooks';

/**
 * A stable function that runs fn after the caller pauses for `ms`. call.cancel() drops a pending
 * run. A pending run still fires if the form closes first, so a half-typed draft is kept.
 */
export function useDebounced(fn, ms = 400) {
  const latest = useRef(fn);
  latest.current = fn;
  const timer = useRef(null);
  const call = useCallback((...args) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => latest.current(...args), ms);
  }, [ms]);
  call.cancel = () => clearTimeout(timer.current);
  return call;
}
