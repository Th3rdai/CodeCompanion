/**
 * Shared helpers for voice dictation append semantics (Web Speech → text fields).
 * Used by BaseBuilderPanel, wizards, and any field that must avoid stale React closures.
 *
 * @see docs/VOICE-DICTATION-PLAN.md
 */

/**
 * Join existing field text with a new speech chunk (trimmed, single space).
 * @param {string|undefined|null} current
 * @param {string} chunk
 * @returns {string}
 */
export function joinAppend(current, chunk) {
  const a = String(current ?? "").trimEnd();
  const b = String(chunk ?? "").trim();
  if (!b) return a;
  if (!a) return b;
  return `${a} ${b}`;
}
