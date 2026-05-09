/**
 * Shared origin checks for HTTPS certificate bypass and media (microphone) access.
 */
const { fileURLToPath } = require("node:url");

function isPrivateLanIPv4(hostname) {
  if (!hostname || typeof hostname !== "string") return false;
  const h = hostname.toLowerCase();
  if (h === "::1") return true;
  if (h.startsWith("[") && h.endsWith("]")) {
    const inner = h.slice(1, -1);
    if (inner === "::1") return true;
  }
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  const c = Number(m[3]);
  const d = Number(m[4]);
  if ([a, b, c, d].some((n) => n > 255)) return false;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 127) return true;
  return false;
}

/**
 * Hostnames for which we accept self-signed / private CA TLS (session verify proc).
 * Does not include port — pair with certificate-error URL checks when possible.
 */
function isLocalOrPrivateLanHostname(hostname) {
  if (!hostname || typeof hostname !== "string") return false;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return true;
  if (h === "::1" || h === "[::1]") return true;
  return isPrivateLanIPv4(h);
}

/**
 * True when the page URL is our app (bundled file pages, localhost, or same-port LAN).
 * @param {string} urlString
 * @param {{ actualPort: number|null, appPath: string, electronDir: string }} ctx
 */
function isTrustedMediaPageUrl(urlString, ctx) {
  if (!urlString || typeof urlString !== "string") return false;
  const { actualPort, appPath, electronDir } = ctx;
  try {
    const u = new URL(urlString);
    const proto = u.protocol;
    if (proto === "file:") {
      const fp = fileURLToPath(urlString);
      return (
        (electronDir && fp.startsWith(electronDir)) ||
        (appPath && fp.startsWith(appPath))
      );
    }
    if (proto !== "https:" && proto !== "http:") return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]")
      return true;
    if (isPrivateLanIPv4(host)) {
      const portStr = u.port || "";
      const samePort =
        actualPort == null ||
        portStr === String(actualPort) ||
        (portStr === "" &&
          ((proto === "https:" && actualPort === 443) ||
            (proto === "http:" && actualPort === 80)));
      return samePort;
    }
    return false;
  } catch {
    return false;
  }
}

module.exports = {
  isPrivateLanIPv4,
  isLocalOrPrivateLanHostname,
  isTrustedMediaPageUrl,
};
