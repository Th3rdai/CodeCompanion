const UNCONFIRMED_IMAGE_CLAIM_PATTERNS = [
  /generated image from [a-z0-9_.-]+\.generate_image\.?/gi,
  /\b(i just generated|fresh)\b[^.!?\n]*\bimage\b[^.!?\n]*/gi,
  /\bthe image (is|should be)( now)? (displayed|visible) above\b[.!]?/gi,
  /\bready to go\b[.!]?/gi,
];
const RESOLUTION_CLAIM_PATTERNS = [
  /\b(i(?:'ve| have)? (?:made sure|ensured|set)|i(?: just)? generated|this image is|the image is|the specific resolution(?: i'?m)? generating is)\b[^.!?\n]{0,140}\b(\d{3,5})\s*[x×]\s*(\d{3,5})\b[^.!?\n]*/gi,
  /\bfresh\b[^.!?\n]{0,100}\b(\d{3,5})\s*[x×]\s*(\d{3,5})\b[^.!?\n]*/gi,
  /\bresolution\b[^.!?\n]{0,100}\b(\d{3,5})\s*[x×]\s*(\d{3,5})\b[^.!?\n]*/gi,
];

const UNCONFIRMED_IMAGE_FALLBACK =
  "Image generation was not confirmed by tool output in this response.";
const UNVERIFIED_RESOLUTION_FALLBACK =
  "Generated image with the requested aspect ratio; exact pixel dimensions depend on model output unless explicitly measured.";

export function sanitizeUnconfirmedImageClaims(
  content,
  hasToolImage,
  verifiedDimensions = [],
) {
  const raw = String(content || "");
  if (!raw) return raw;
  const verified = new Set(
    (verifiedDimensions || []).map((d) => String(d || "").toLowerCase()),
  );
  let sanitized = raw;

  if (!hasToolImage) {
    for (const pattern of UNCONFIRMED_IMAGE_CLAIM_PATTERNS) {
      sanitized = sanitized.replace(pattern, " ");
    }
  }

  for (const pattern of RESOLUTION_CLAIM_PATTERNS) {
    sanitized = sanitized.replace(pattern, (...args) => {
      const fullMatch = args[0];
      const captures = args.slice(1, -2);
      const maybeWidth = Number(captures[captures.length - 2]);
      const maybeHeight = Number(captures[captures.length - 1]);
      if (Number.isFinite(maybeWidth) && Number.isFinite(maybeHeight)) {
        const dims = `${maybeWidth}x${maybeHeight}`.toLowerCase();
        if (verified.has(dims)) return fullMatch;
      }
      return UNVERIFIED_RESOLUTION_FALLBACK;
    });
  }

  sanitized = sanitized.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  sanitized = sanitized.replace(/\.{2,}/g, ".");
  sanitized = sanitized.trim();
  if (!sanitized && raw.trim()) {
    return hasToolImage
      ? UNVERIFIED_RESOLUTION_FALLBACK
      : UNCONFIRMED_IMAGE_FALLBACK;
  }
  return sanitized;
}
