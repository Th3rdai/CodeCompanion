/**
 * Host (Node process) clock snapshot for the Code Companion server machine.
 * Used by GET /api/host-time so the SPA/Electron UI can align with server time.
 *
 * @param {{ now?: Date }} [options]
 * @returns {{
 *   iso: string,
 *   unixMs: number,
 *   timezone: string,
 *   offsetMinutesFromUtc: number,
 *   localeString: string
 * }}
 */
function getHostTimeSnapshot(options = {}) {
  const now =
    options.now instanceof Date && !Number.isNaN(options.now.getTime())
      ? options.now
      : new Date();

  return {
    iso: now.toISOString(),
    unixMs: now.getTime(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    /**
     * Minutes to add to UTC to get local civil time (e.g. +60 for UTC+1).
     * Equals `-now.getTimezoneOffset()` (JavaScript’s offset is defined the other way).
     */
    offsetMinutesFromUtc: -now.getTimezoneOffset(),
    localeString: now.toString(),
  };
}

/**
 * One-line prefix for LLM system prompts: host-local date + time, timezone, UTC calendar date, ISO instant.
 *
 * @param {{ now?: Date }} [options]
 * @returns {string}
 */
function formatHostTimeForPrompt(options = {}) {
  const now =
    options.now instanceof Date && !Number.isNaN(options.now.getTime())
      ? options.now
      : new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
  const localDate = now.toLocaleDateString("en-CA");
  const localTime = now.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const utcCal = now.toISOString().slice(0, 10);
  return `CURRENT_HOST_TIME: ${localDate} ${localTime} (${tz}; UTC calendar date ${utcCal}; instant ${now.toISOString()})\n\n`;
}

module.exports = { getHostTimeSnapshot, formatHostTimeForPrompt };
