/**
 * Fetch wrapper: sends X-CC-API-Key when VITE_CC_API_KEY is set at build time
 * (must match server CC_API_SECRET) so LAN/browser UIs can call localhost-only APIs.
 */
export function apiFetch(input, init = {}) {
  const headers = new Headers(init.headers);
  const key = import.meta.env.VITE_CC_API_KEY;
  if (key && !headers.has('X-CC-API-Key')) {
    headers.set('X-CC-API-Key', key);
  }
  return fetch(input, { ...init, headers });
}
