/**
 * electron-builder 26+ rejects `identity` values that still include the
 * "Developer ID Application:" prefix (it picks the cert automatically). CI and
 * local env often use the full Keychain name — strip the prefix when present.
 */
function normalizeMacCodesignIdentity(value) {
  const s = String(value || "").trim();
  if (!s) return s;
  return s.replace(/^Developer ID Application:\s*/i, "").trim();
}

module.exports = { normalizeMacCodesignIdentity };
