/**
 * Clipboard utilities with fallbacks for non-secure contexts.
 *
 * navigator.clipboard requires a secure context (HTTPS with valid cert).
 * Self-signed certs and some browsers deny the permission, so every
 * operation falls back to the legacy document.execCommand API.
 */

/**
 * Copy text to clipboard with fallback.
 * @param {string} text
 * @returns {Promise<boolean>} true if copied successfully
 */
export async function copyText(text) {
  // Try modern API first
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied — fall through to legacy
    }
  }

  // Fallback: temporary textarea + execCommand
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    return true;
  } catch {
    return false;
  } finally {
    document.body.removeChild(ta);
  }
}

/**
 * Read text from clipboard with fallback.
 *
 * navigator.clipboard.readText() requires the clipboard-read permission
 * which browsers rarely grant automatically. When denied, this function
 * returns null — callers should then prompt the user to Ctrl/Cmd+V instead.
 *
 * @returns {Promise<string|null>} clipboard text, or null if denied
 */
export async function readText() {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // Permission denied
    }
  }
  return null;
}
