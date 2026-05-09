/**
 * Shared brand-asset context helpers.
 *
 * The Settings → Brand Assets list is surfaced to the AI in two places:
 *  1. As a system-prompt block injected into AI calls (chat, review,
 *     build-research, build-plan, build-next-action, tutorial-suggestions).
 *  2. As a `_config/brand.md` file written by the Create + Build scaffolders
 *     so each generated project carries a persistent record of the
 *     configured brand assets.
 *
 * Centralising these formatters keeps the copy consistent and lets us
 * change wording in one place.
 */

function _validAssets(brandAssets) {
  if (!Array.isArray(brandAssets)) return [];
  return brandAssets.filter(
    (a) => a && typeof a === "object" && (a.label || a.path),
  );
}

/**
 * Format brand assets for injection into an AI system prompt.
 * Returns an empty string when no brand assets are configured so callers
 * can unconditionally `+= brandPrompt` without an extra null check.
 *
 * @param {Array<{label?:string, path?:string, description?:string}>} brandAssets
 * @returns {string}
 */
function formatBrandAssetsPrompt(brandAssets) {
  const assets = _validAssets(brandAssets);
  if (assets.length === 0) return "";
  const lines = assets.map(
    (a) =>
      `- ${a.label || "Asset"}: ${a.path || "(no path)"}${
        a.description ? " — " + a.description : ""
      }`,
  );
  return (
    "\n\n---\nBRAND ASSETS: The user has configured these brand/logo/image files. " +
    "Do NOT proactively add branding to casual chat replies, code explanations, code reviews, debugging help, or internal working notes — keep those plain. " +
    "Reach for these assets only when the user explicitly asks for branded output, OR when the request clearly implies an external/shareable artifact (customer-facing report, deliverable, presentation, public-facing diagram, marketing copy, exported document). " +
    "If the user asks for no branding, respect that.\n" +
    lines.join("\n")
  );
}

/**
 * Render a `_config/brand.md` file body for scaffolded projects.
 * Returns null when no brand assets are configured so callers can skip
 * writing the file entirely.
 *
 * @param {Array<{label?:string, path?:string, description?:string}>} brandAssets
 * @returns {string|null}
 */
function buildBrandScaffoldFile(brandAssets) {
  const assets = _validAssets(brandAssets);
  if (assets.length === 0) return null;
  const rows = assets
    .map((a) => {
      const label = (a.label || "Asset").replace(/\|/g, "\\|");
      const p = (a.path || "").replace(/\|/g, "\\|");
      const desc = (a.description || "").replace(/\|/g, "\\|");
      return `| ${label} | \`${p}\` | ${desc} |`;
    })
    .join("\n");
  return `# Brand Assets

These are the brand/logo/image files registered in Code Companion → Settings → Brand Assets at the time this project was scaffolded.

## When to use them

**Yes** — when the user explicitly asks for branded output, OR when generating an external/shareable artifact: customer-facing reports, deliverables, presentations, public-facing diagrams, marketing copy, exported documents.

**No** — do not proactively add branding to casual chat replies, code explanations, code reviews, debugging help, or internal working notes. Keep those plain unless asked.

If the user asks for no branding on a specific output, respect that.

## Registered assets

| Label | Path | Description |
|-------|------|-------------|
${rows}

> Update this file when brand assets change for this project. The list in Code Companion is the source of truth for new generations.
`;
}

module.exports = {
  formatBrandAssetsPrompt,
  buildBrandScaffoldFile,
};
