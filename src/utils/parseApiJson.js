/**
 * Parse JSON from a fetch Response. If the server returned HTML (e.g. SPA fallback
 * or a proxy serving index.html for unknown paths), throw a clear error instead
 * of "Unexpected token '<'".
 *
 * @param {Response} res
 * @returns {Promise<Record<string, unknown>>}
 */
export async function parseApiJson(res) {
  const text = await res.text();
  const trimmed = text.trimStart();
  if (!trimmed) return {};
  if (trimmed.startsWith("<")) {
    throw new Error(
      "Server returned a web page instead of API data. Restart the app after updates, and if you use a reverse proxy, forward /api/* to the Code Companion Node server (see BUILD.md).",
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid response from server (not valid JSON).");
  }
}
