/**
 * Tests for the shared brand-asset context helper (lib/brand-context.js).
 * The Settings → Brand Assets list is surfaced to AI prompts and to
 * scaffolded projects through these formatters; both must handle empty
 * input cleanly so callers can stay branchless.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  formatBrandAssetsPrompt,
  buildBrandScaffoldFile,
} = require("../../lib/brand-context");

// ─── formatBrandAssetsPrompt ────────────────────────────────────────────────

test("formatBrandAssetsPrompt: empty array → empty string (callers can append unconditionally)", () => {
  assert.equal(formatBrandAssetsPrompt([]), "");
});

test("formatBrandAssetsPrompt: undefined / null / non-array → empty string", () => {
  assert.equal(formatBrandAssetsPrompt(undefined), "");
  assert.equal(formatBrandAssetsPrompt(null), "");
  assert.equal(formatBrandAssetsPrompt({}), "");
  assert.equal(formatBrandAssetsPrompt("nope"), "");
});

test("formatBrandAssetsPrompt: filters entries that have neither label nor path", () => {
  assert.equal(formatBrandAssetsPrompt([{}, { description: "orphan" }]), "");
});

test("formatBrandAssetsPrompt: emits BRAND ASSETS block with each asset on its own line", () => {
  const out = formatBrandAssetsPrompt([
    {
      label: "Primary Logo",
      path: "/Users/me/brand/logo.svg",
      description: "Use on light backgrounds",
    },
    { label: "Mark", path: "/Users/me/brand/mark.png" },
  ]);
  assert.match(out, /BRAND ASSETS:/);
  assert.match(
    out,
    /Primary Logo: \/Users\/me\/brand\/logo\.svg — Use on light backgrounds/,
  );
  assert.match(out, /Mark: \/Users\/me\/brand\/mark\.png/);
  // The block starts with `\n\n---\n` so it appends cleanly to a system prompt.
  assert.ok(out.startsWith("\n\n---\n"), "starts with section divider");
});

test("formatBrandAssetsPrompt: missing label falls back to 'Asset'; missing path is shown explicitly", () => {
  const out = formatBrandAssetsPrompt([{ description: "x", path: "/p.svg" }]);
  // No label → "Asset"
  assert.match(out, /- Asset: \/p\.svg — x/);
});

test("formatBrandAssetsPrompt: encodes the in-between policy (no proactive branding for casual output, do brand external/shareable artifacts)", () => {
  const out = formatBrandAssetsPrompt([
    { label: "Logo", path: "/brand/logo.svg" },
  ]);
  // Negative scope: explicitly tell the model NOT to brand casual / internal output.
  assert.match(out, /Do NOT proactively add branding/);
  assert.match(out, /casual chat replies/);
  assert.match(out, /code explanations/);
  assert.match(out, /code reviews/);
  // Positive scope: external/shareable artifacts trigger branding.
  assert.match(out, /external\/shareable artifact/);
  assert.match(out, /customer-facing|presentation|marketing/i);
  // User opt-out is respected.
  assert.match(out, /If the user asks for no branding/i);
});

// ─── buildBrandScaffoldFile ─────────────────────────────────────────────────

test("buildBrandScaffoldFile: empty input → null (callers skip writing the file)", () => {
  assert.equal(buildBrandScaffoldFile([]), null);
  assert.equal(buildBrandScaffoldFile(undefined), null);
  assert.equal(buildBrandScaffoldFile([{}, { description: "orphan" }]), null);
});

test("buildBrandScaffoldFile: renders a markdown file with one row per asset and the in-between policy", () => {
  const md = buildBrandScaffoldFile([
    {
      label: "Primary Logo",
      path: "/brand/logo.svg",
      description: "Light bg",
    },
    { label: "Mark", path: "/brand/mark.png", description: "" },
  ]);
  assert.ok(md, "non-null when assets present");
  assert.match(md, /^# Brand Assets/);
  // Policy section is present so downstream tools (Claude Code, Cursor) reading
  // the project see the same opt-in/opt-out rules as the live system prompt.
  assert.match(md, /## When to use them/);
  assert.match(md, /external\/shareable artifact/);
  assert.match(md, /do not proactively add branding/i);
  assert.match(md, /\| Label \| Path \| Description \|/);
  assert.match(md, /\| Primary Logo \| `\/brand\/logo\.svg` \| Light bg \|/);
  assert.match(md, /\| Mark \| `\/brand\/mark\.png` \|\s*\|/);
});

test("buildBrandScaffoldFile: escapes pipe characters in content so the markdown table stays valid", () => {
  const md = buildBrandScaffoldFile([
    { label: "Logo | Primary", path: "/a|b.svg", description: "x | y" },
  ]);
  assert.match(md, /Logo \\\| Primary/);
  assert.match(md, /\/a\\\|b\.svg/);
  assert.match(md, /x \\\| y/);
});
