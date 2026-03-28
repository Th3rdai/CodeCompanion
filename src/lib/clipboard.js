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
  // Try modern API first (works in user-gesture context even with self-signed certs in some browsers)
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied — fall through to legacy
    }
  }

  // Fallback: temporary textarea + execCommand
  // Must be visible and in-viewport for execCommand to work reliably
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:none;outline:none;box-shadow:none;opacity:0.01;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  // Also set selection range for iOS
  ta.setSelectionRange(0, text.length);
  try {
    const ok = document.execCommand('copy');
    return ok;
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
  if (navigator.clipboard) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      // Permission denied
    }
  }
  return null;
}
