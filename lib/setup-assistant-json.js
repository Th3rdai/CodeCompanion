"use strict";

/**
 * Strip markdown ```json fences often returned by cloud models.
 * @param {string} text
 * @returns {string}
 */
function stripCodeFences(text) {
  let s = String(text || "").trim();
  s = s.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
  return s.trim();
}

/**
 * Extract first brace-balanced `{ ... }` substring (best-effort for LLM JSON).
 * @param {string} text
 * @returns {string | null}
 */
function extractFirstJsonObject(text) {
  const cleaned = stripCodeFences(text);
  const start = cleaned.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * @param {string} text
 * @returns {{ intents?: unknown, summary?: string } | null}
 */
function parseSetupAssistantJson(text) {
  const slice = extractFirstJsonObject(text);
  if (!slice) return null;
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

module.exports = {
  stripCodeFences,
  extractFirstJsonObject,
  parseSetupAssistantJson,
};
