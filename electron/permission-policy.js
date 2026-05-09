/**
 * Chromium permission allowlist for our Electron renderer.
 *
 * Anything NOT in this set is denied outright by main.js's
 * setPermissionRequestHandler / setPermissionCheckHandler. A trusted-origin
 * check (isTrustedMediaPageUrl) gates the entries that ARE in the set.
 *
 * Do not shrink this list without checking the toolbar — `clipboard-read` and
 * `clipboard-sanitized-write` are required for the 📋 Paste / 📑 Copy Response
 * buttons to function. See tests/unit/permission-policy.test.js.
 */
const TRUSTED_ORIGIN_PERMISSIONS = new Set([
  // getUserMedia / Web Speech (audio-only — see mediaPermissionWantsAudioOnly)
  "media",
  // navigator.clipboard.readText() — toolbar Paste button
  "clipboard-read",
  // navigator.clipboard.writeText() — toolbar Copy Response button
  "clipboard-sanitized-write",
]);

module.exports = { TRUSTED_ORIGIN_PERMISSIONS };
