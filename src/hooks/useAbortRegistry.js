/**
 * Module-level abort registry for global Escape key coordination.
 * Panels register their abort callbacks on mount and unregister on unmount.
 * App.jsx calls abortAll() when Escape is pressed.
 */
const registry = new Set();

export function registerAbort(fn) {
  registry.add(fn);
}
export function unregisterAbort(fn) {
  registry.delete(fn);
}
export function abortAll() {
  registry.forEach((fn) => fn());
}
