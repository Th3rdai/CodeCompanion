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
const FAKE_TOOL_RESULT_NOTICE =
  "> ⚠️ The model wrote a tool-result block here, but no tool was actually invoked. Ignore the claimed file path or image preview.";
const FAKE_TOOL_CODE_NOTICE =
  "⚠️ The model emitted a `TOOL_CODE:` / `tool_code` block here (Gemma-family hallucination format), but no tool was actually invoked. Switch to a tool-call-trained model (e.g. kimi-k2:1t-cloud or minimax-m2:cloud) for image generation.";

/**
 * Detect and strip Gemma-family hallucinated tool-code lines/blocks. Gemma
 * models occasionally emit `TOOL_CODE: print("Image generated successfully.")`
 * or fenced ```tool_code\n...print(...)``` blocks instead of the project's
 * actual TOOL_CALL syntax — looks plausible but the parser ignores it, so
 * no real generation happens. Replace with an actionable warning so the
 * user knows to switch models.
 */
function stripFakeToolCodeArtifacts(text) {
  let out = text;
  // Fenced ```tool_code ... ``` blocks (Gemma's documented format).
  out = out.replace(/```tool_code\s*\n[\s\S]*?\n?```/gi, FAKE_TOOL_CODE_NOTICE);
  // Bare `TOOL_CODE: ...` lines that claim image-related work; conservative
  // gate so legitimate prose mentioning the literal keyword survives.
  out = out.replace(
    /^[ \t]*TOOL_CODE:[ \t]*[^\n]*?(?:image|generate|generated|\.png)[^\n]*$/gim,
    FAKE_TOOL_CODE_NOTICE,
  );
  return out;
}

/**
 * Detect and strip blockquoted prose that mimics the system's tool-result
 * rendering ("> 🔧 **Tool result:**", "Tool x.generate_image returned:", etc.)
 * when no real tool image was attached. Models occasionally fabricate these
 * blocks instead of emitting a real TOOL_CALL, lying about a successful
 * generation. Replaces the entire fake block with a single warning line so
 * the user isn't misled.
 */
function stripFakeToolResultBlocks(text) {
  const lines = text.split("\n");
  const out = [];
  let i = 0;
  while (i < lines.length) {
    if (!/^\s*>/.test(lines[i])) {
      out.push(lines[i]);
      i++;
      continue;
    }
    // Gather a contiguous run of blockquote lines.
    const blockStart = i;
    while (i < lines.length && /^\s*>/.test(lines[i])) i++;
    const block = lines.slice(blockStart, i).join("\n");
    const looksLikeToolResultHeader =
      /\bTool result\b/i.test(block) ||
      /\bTool\s+[a-z0-9_.-]+\.(?:generate_image|edit_image|create_image)\s+returned\b/i.test(
        block,
      );
    const claimsImageSuccess =
      /Generated\s+\d+\s+image/i.test(block) ||
      /\bgenerate_image\b/i.test(block) ||
      /\.png\b/i.test(block) ||
      /Thumbnail previews shown below/i.test(block);
    if (looksLikeToolResultHeader && claimsImageSuccess) {
      out.push(FAKE_TOOL_RESULT_NOTICE);
    } else {
      out.push(block);
    }
  }
  return out.join("\n");
}

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
    sanitized = stripFakeToolResultBlocks(sanitized);
    sanitized = stripFakeToolCodeArtifacts(sanitized);
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
