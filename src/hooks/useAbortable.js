import { useRef, useCallback } from 'react';

/**
 * Shared AbortController lifecycle hook.
 * Each panel creates one (or more) instances to manage fetch abort.
 */
export function useAbortable() {
  const controllerRef = useRef(null);

  /** Create a fresh AbortController and return its signal for fetch. */
  const startAbortable = useCallback(() => {
    controllerRef.current?.abort();
    const ac = new AbortController();
    controllerRef.current = ac;
    return ac.signal;
  }, []);

  /** Abort the active request (Stop button / Escape key). */
  const abort = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  /** Returns true if an error is an AbortError. */
  const isAborted = useCallback((err) => err?.name === 'AbortError', []);

  /** Null out the ref (call in finally block). */
  const clearAbortable = useCallback(() => {
    controllerRef.current = null;
  }, []);

  return { startAbortable, abort, isAborted, clearAbortable };
}
