import { apiFetch } from "./api-fetch.js";

/**
 * Fetch the Code Companion server host clock (same machine as Node in dev/packaged app).
 * @returns {Promise<{
 *   iso: string,
 *   unixMs: number,
 *   timezone: string,
 *   offsetMinutesFromUtc: number,
 *   localeString: string
 * }>}
 */
export async function fetchHostTime() {
  const res = await apiFetch("/api/host-time");
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(
      `Host time unavailable: ${res.status}${t ? ` — ${t.slice(0, 200)}` : ""}`,
    );
  }
  return res.json();
}
