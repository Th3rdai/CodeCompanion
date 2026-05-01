/**
 * Pure parser functions for experiment step summaries.
 *
 * The model is instructed to emit a markdown block of the shape:
 *
 *   ### Step summary
 *   - **Did:** ...
 *   - **Observed:** ...
 *   - **Next:** ... | **Done**
 *   - **Decision:** keep|iterate|discard   (optional)
 *
 *   ```metric
 *   {"value": 42}
 *   ```
 *
 * These functions are the only place that touches raw model text. They are
 * called by routes/experiment.js on the server side; clients never parse and
 * never submit structured fields directly (trust boundary).
 */

const FIELD_LABELS = ["did", "observed", "next", "decision"];

function _stripFormatting(s) {
  if (typeof s !== "string") return "";
  return s
    .replace(/\*\*/g, "")
    .replace(/^[\s\-\*•]+/, "")
    .trim();
}

/**
 * Extract { did, observed, next, done } from raw assistant text.
 * Tolerant: works whether the model wrapped fields in ** **, used dashes
 * or asterisks for bullets, used different casing, or split fields across
 * paragraphs. Missing fields → null. Done detection is a separate signal.
 */
function parseStepSummary(rawSummary) {
  const out = { did: null, observed: null, next: null, done: false };
  if (!rawSummary || typeof rawSummary !== "string") return out;

  const text = rawSummary.replace(/\r\n/g, "\n");

  // Look for the Step summary block; fall back to scanning the entire text
  // if the heading is absent (some models drop the heading).
  const blockMatch = text.match(/###\s*Step\s*summary\s*\n([\s\S]+)/i);
  const block = blockMatch ? blockMatch[1] : text;

  // Single-line label extraction. Handles "- **Did:** value", "Did: value",
  // "* did - value", etc. Captures up to the next field label or end-of-text.
  const labelAlt = FIELD_LABELS.join("|");
  const fieldRe = new RegExp(
    `(?:^|\\n)\\s*[-*•]?\\s*\\**\\s*(${labelAlt})\\s*\\**\\s*[:\\-—]\\s*([\\s\\S]*?)(?=\\n\\s*[-*•]?\\s*\\**\\s*(?:${labelAlt})\\s*\\**\\s*[:\\-—]|\\n\\s*\`\`\`|\\n\\s*###|$)`,
    "gi",
  );

  let m;
  while ((m = fieldRe.exec(block)) !== null) {
    const key = m[1].toLowerCase();
    const value = _stripFormatting(m[2]);
    if (key === "decision") continue;
    if (out[key] === null && value) {
      out[key] = value;
    }
  }

  // Done detection — covers all the shapes the model (or the Mark complete
  // synthetic text) emits:
  //   **Done**                        ← standalone
  //   - **Done**                      ← bullet
  //   * Done                          ← bullet without ** wrap
  //   Next: ... | **Done**            ← inline tail
  //   Done.                           ← end of sentence
  // The leading [\-*•]\s*) clause is critical: missing it is what made
  // Mark complete fail to flip the run to completed in dev (v1.6.29 dogfood).
  const doneRe =
    /(?:^|\n|\|)\s*(?:[-*•]\s*)?(?:\*\*\s*)?done(?:\s*\*\*)?(?:\s*[.!\)]|\s*$)/im;
  if (doneRe.test(block)) {
    out.done = true;
  }

  // If "Next:" content explicitly says Done / blocked / give up, normalize
  // (don't lose the human-readable string, just also set done flag).
  if (out.next && /\b(done|finished|complete)\b/i.test(out.next)) {
    out.done = true;
  }

  return out;
}

/**
 * Extract { value } from a fenced ```metric { "value": N } ``` block.
 * Returns null when absent or when the JSON is malformed.
 */
function extractMetricBlock(rawSummary) {
  if (!rawSummary || typeof rawSummary !== "string") return null;
  const text = rawSummary.replace(/\r\n/g, "\n");
  const re = /```\s*metric\s*\n([\s\S]*?)\n```/i;
  const m = text.match(re);
  if (!m) return null;
  const body = m[1].trim();
  try {
    const parsed = JSON.parse(body);
    if (parsed === null || typeof parsed !== "object") return null;
    if (!("value" in parsed)) return null;
    const v = parsed.value;
    if (v === null) return { value: null };
    if (typeof v !== "number" || !Number.isFinite(v)) return null;
    return { value: v };
  } catch {
    return null;
  }
}

/**
 * Pull tool-denial events out of the raw summary. Matches the format from
 * `Command denied: <reason>\nACTION: <next step>` introduced in the agent
 * tool handler. Multiple denials in one turn are returned in order.
 *
 * The "name" we attach is best-effort — when the prompt-format includes the
 * tool name (e.g. "Command denied (run_terminal_cmd):"), we extract it;
 * otherwise it's left blank and consumers treat it as anonymous.
 */
function extractDeniedToolCalls(rawSummary) {
  const out = [];
  if (!rawSummary || typeof rawSummary !== "string") return out;
  const text = rawSummary.replace(/\r\n/g, "\n");
  const re = /Command denied(?:\s*\(([^)]+)\))?\s*:\s*([^\n]+)/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      name: (m[1] || "").trim(),
      reason: (m[2] || "").trim(),
    });
  }
  return out;
}

/**
 * Decide whether to keep, iterate on, or discard the current step's
 * approach for the next round. Pure function over the structured shape.
 *
 * Rules:
 *   - done: true                                → "keep"
 *   - explicit **Decision:** in raw text wins  (handled separately)
 *   - blocked / give up / unable / cannot      → "discard"
 *   - 2+ denials in this single turn           → "discard" (likely wrong tool)
 *   - otherwise                                → "iterate"
 */
function inferDecision({ next, done, denials, rawSummary } = {}) {
  if (rawSummary && typeof rawSummary === "string") {
    const m = rawSummary.match(
      /(?:\*\*\s*)?Decision(?:\s*\*\*)?\s*:\s*\**\s*(keep|iterate|discard)\b/i,
    );
    if (m) return m[1].toLowerCase();
  }
  if (done) return "keep";
  const nextStr = (next || "").toLowerCase();
  const blockedRe = /\b(blocked|give\s*up|unable|cannot|can'?t)\b/;
  if (blockedRe.test(nextStr)) return "discard";
  const denialCount = Array.isArray(denials) ? denials.length : 0;
  if (denialCount >= 2) return "discard";
  return "iterate";
}

module.exports = {
  parseStepSummary,
  extractMetricBlock,
  extractDeniedToolCalls,
  inferDecision,
};
