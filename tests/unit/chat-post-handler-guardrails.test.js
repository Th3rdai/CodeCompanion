/**
 * Unit tests for guardrails added to chat-post-handler.js (2026-05-05).
 *
 * Background: the 2026-05-05 PDF-summarize bug surfaced gemma4 hallucinating a
 * 53.9 KB `generate_office_file` call from an error-stub attachment. The
 * remediation added two guardrails to chat-post-handler.js:
 *
 *  1. `userExplicitlyDisallowsFileWrites(messages)` — when the user phrases
 *     their request to forbid file output, the executor refuses
 *     `builtin.write_file` / `builtin.generate_office_file` for that turn.
 *
 *  2. `computeToolCallSignature(toolCalls)` — deterministic key used to detect
 *     duplicate tool+args repeats and break the loop instead of running the
 *     same side effect again.
 *
 * Both helpers are pure. The tests below pin behaviour and document the
 * false-positive cases the regex was tightened to avoid.
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  userExplicitlyDisallowsFileWrites,
  userExplicitlyRequestsFileWrites,
  computeToolCallSignature,
  looksLikeFileWritePolicyMetaResponse,
  stripAttachedFileBlock,
  userLikelyRequestedActionableToolWork,
} = require("../../lib/chat-post-handler");

// ─── userExplicitlyDisallowsFileWrites — positives ─────────────────────────

test("disallows-files: 'do not generate any files' → true", () => {
  const messages = [{ role: "user", content: "do not generate any files" }];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), true);
});

test("disallows-files: 'don't create a docx' → true", () => {
  const messages = [
    { role: "user", content: "Just summarise — don't create a docx." },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), true);
});

test("disallows-files: 'no PDF please' → true", () => {
  const messages = [
    { role: "user", content: "Review this code, no PDF please." },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), true);
});

test("disallows-files: 'without saving to disk' → true", () => {
  const messages = [
    { role: "user", content: "Analyse this without saving to disk." },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), true);
});

test("disallows-files: 'don't write to file' → true", () => {
  const messages = [
    { role: "user", content: "Run the test but don't write to file." },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), true);
});

test("disallows-files: only the latest user message is consulted", () => {
  const messages = [
    { role: "user", content: "Earlier I said don't generate any files" },
    { role: "assistant", content: "ok" },
    { role: "user", content: "Now do it normally." },
  ];
  // Latest message has no forbid cue — function must look only at the latest.
  assert.equal(userExplicitlyDisallowsFileWrites(messages), false);
});

// ─── userExplicitlyDisallowsFileWrites — false-positive guards ──────────────
// These were the cases the looser pre-2026-05-05 regex incorrectly matched.

test('disallows-files: "don\'t write your usual long preamble" → false (verb-only is not enough)', () => {
  const messages = [
    {
      role: "user",
      content: "Summarise this. Don't write your usual long preamble.",
    },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), false);
});

test("disallows-files: 'no need to save this output' → false (generic 'output' no longer in noun list)", () => {
  const messages = [
    {
      role: "user",
      content: "Run it. No need to save this output, just show me.",
    },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), false);
});

test('disallows-files: "I don\'t want to create another version" → false (no file-target noun)', () => {
  const messages = [
    {
      role: "user",
      content: "I don't want to create another version of this.",
    },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), false);
});

test("disallows-files: 'without exporting credentials' → false (no file noun)", () => {
  const messages = [
    {
      role: "user",
      content: "Test the auth flow without exporting credentials.",
    },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), false);
});

test("disallows-files: forbid cue too far from file noun is not matched", () => {
  // 80-char proximity window — anything farther shouldn't match.
  const messages = [
    {
      role: "user",
      content: "don't " + "x".repeat(120) + " file",
    },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), false);
});

// ─── userExplicitlyDisallowsFileWrites — defensive cases ────────────────────

test("disallows-files: empty messages array → false", () => {
  assert.equal(userExplicitlyDisallowsFileWrites([]), false);
});

test("disallows-files: missing argument → false", () => {
  assert.equal(userExplicitlyDisallowsFileWrites(), false);
});

test("disallows-files: latest user message has non-string content → false", () => {
  const messages = [
    { role: "user", content: [{ type: "text", text: "no pdf" }] },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(messages), false);
});

// ─── userExplicitlyRequestsFileWrites — positives ──────────────────────────
// These prompts should let chat-mode write_file / generate_office_file calls
// proceed (the user clearly asked for a file artefact).

test("requests-files: 'save this as a markdown file' → true", () => {
  const m = [{ role: "user", content: "save this as a markdown file" }];
  assert.equal(userExplicitlyRequestsFileWrites(m), true);
});

test("requests-files: 'export to PDF' → true", () => {
  const m = [{ role: "user", content: "Run the analysis and export to PDF." }];
  assert.equal(userExplicitlyRequestsFileWrites(m), true);
});

test("requests-files: 'generate a docx report' → true", () => {
  const m = [{ role: "user", content: "Generate a docx report of findings." }];
  assert.equal(userExplicitlyRequestsFileWrites(m), true);
});

test("requests-files: 'create a summary document' → true", () => {
  const m = [{ role: "user", content: "Please create a summary document." }];
  assert.equal(userExplicitlyRequestsFileWrites(m), true);
});

test("requests-files: 'save as report.pdf' (Pattern B — extension) → true", () => {
  const m = [
    { role: "user", content: "Save the result as report.pdf for me." },
  ];
  assert.equal(userExplicitlyRequestsFileWrites(m), true);
});

test("requests-files: 'write the analysis to a file' → true", () => {
  const m = [{ role: "user", content: "Write the analysis to a file." }];
  assert.equal(userExplicitlyRequestsFileWrites(m), true);
});

test("requests-files: 'output a JSON file' → true", () => {
  const m = [{ role: "user", content: "Output a JSON file with the data." }];
  assert.equal(userExplicitlyRequestsFileWrites(m), true);
});

// ─── userExplicitlyRequestsFileWrites — false-positive guards ───────────────
// These prompts MUST return false — they're the 2026-05-05 regression case
// (model decides to save a file from a benign prompt).

test("requests-files: 'please review and summarize this pdf' → false (THE regression case)", () => {
  const m = [{ role: "user", content: "please review and summarize this pdf" }];
  assert.equal(userExplicitlyRequestsFileWrites(m), false);
});

test("requests-files: 'summarize this PDF' → false (no save/export verb)", () => {
  const m = [{ role: "user", content: "summarize this PDF for me" }];
  assert.equal(userExplicitlyRequestsFileWrites(m), false);
});

test("requests-files: 'save your time and skip the analysis' → false (no file noun nearby)", () => {
  const m = [
    { role: "user", content: "Save your time and skip the analysis." },
  ];
  assert.equal(userExplicitlyRequestsFileWrites(m), false);
});

test("requests-files: 'create a list of issues' → false (no file noun)", () => {
  const m = [{ role: "user", content: "Create a list of issues in chat." }];
  assert.equal(userExplicitlyRequestsFileWrites(m), false);
});

test("requests-files: 'I'll write a summary myself' → false", () => {
  const m = [{ role: "user", content: "I'll write a summary myself, thanks." }];
  assert.equal(userExplicitlyRequestsFileWrites(m), false);
});

// ─── userExplicitlyRequestsFileWrites — defensive cases ─────────────────────

test("requests-files: empty messages array → false", () => {
  assert.equal(userExplicitlyRequestsFileWrites([]), false);
});

test("requests-files: missing argument → false", () => {
  assert.equal(userExplicitlyRequestsFileWrites(), false);
});

test("requests-files: non-string latest content → false", () => {
  const m = [
    { role: "user", content: [{ type: "text", text: "save as pdf" }] },
  ];
  assert.equal(userExplicitlyRequestsFileWrites(m), false);
});

// ─── computeToolCallSignature ──────────────────────────────────────────────

test("signature: empty list → empty string", () => {
  assert.equal(computeToolCallSignature([]), "");
});

test("signature: missing argument → empty string", () => {
  assert.equal(computeToolCallSignature(), "");
});

test("signature: stable for same tool + same args (regression target for the duplicate-loop guard)", () => {
  const a = [
    {
      serverId: "builtin",
      toolName: "generate_office_file",
      args: { format: "txt", filename: "x.txt", content: "hello" },
    },
  ];
  const b = [
    {
      serverId: "builtin",
      toolName: "generate_office_file",
      args: { format: "txt", filename: "x.txt", content: "hello" },
    },
  ];
  assert.equal(computeToolCallSignature(a), computeToolCallSignature(b));
});

test("signature: differs when args differ", () => {
  const a = [
    {
      serverId: "builtin",
      toolName: "write_file",
      args: { path: "/a", content: "x" },
    },
  ];
  const b = [
    {
      serverId: "builtin",
      toolName: "write_file",
      args: { path: "/b", content: "x" },
    },
  ];
  assert.notEqual(computeToolCallSignature(a), computeToolCallSignature(b));
});

test("signature: differs when tool differs", () => {
  const args = { path: "/a" };
  const a = [{ serverId: "builtin", toolName: "write_file", args }];
  const b = [{ serverId: "builtin", toolName: "read_file", args }];
  assert.notEqual(computeToolCallSignature(a), computeToolCallSignature(b));
});

test("signature: handles unserialisable args without throwing (BigInt edge case)", () => {
  const cyclic = {};
  cyclic.self = cyclic;
  const calls = [{ serverId: "test", toolName: "loop", args: cyclic }];
  assert.doesNotThrow(() => computeToolCallSignature(calls));
  // Result is a string (fallback to String(args)), even if not the JSON form.
  assert.equal(typeof computeToolCallSignature(calls), "string");
});

test("signature: multiple calls joined deterministically (order matters)", () => {
  const a = [
    { serverId: "builtin", toolName: "read_file", args: { path: "/a" } },
    { serverId: "builtin", toolName: "read_file", args: { path: "/b" } },
  ];
  const b = [
    { serverId: "builtin", toolName: "read_file", args: { path: "/b" } },
    { serverId: "builtin", toolName: "read_file", args: { path: "/a" } },
  ];
  // Order is part of the signature — different tool sequences should not be
  // collapsed as duplicates.
  assert.notEqual(computeToolCallSignature(a), computeToolCallSignature(b));
});

test("signature: missing serverId/toolName fields produce a stable key, not undefined", () => {
  const sig = computeToolCallSignature([{ args: {} }]);
  assert.equal(typeof sig, "string");
  assert.ok(
    !sig.includes("undefined"),
    `signature contained 'undefined': ${sig}`,
  );
});

// ─── stripAttachedFileBlock ──────────────────────────────────────────────────
// The frontend builds the user message as:
//   <user prompt>
//   \n---\nATTACHED FILES:\n
//   ### filename.pdf (filename.pdf)\n
//   ```\n<converted markdown>\n```\n
// Without stripping, intent regexes match content inside the attached PDF.

test("strip-attachments: removes standard ATTACHED FILES block", () => {
  const full =
    "summarize this pdf\n\n---\nATTACHED FILES:\n\n### a.pdf\n```\nrun a check on the file\n```\n";
  assert.equal(stripAttachedFileBlock(full), "summarize this pdf");
});

test("strip-attachments: removes block with =====/_____ separators", () => {
  const full =
    "review the attached\n\n=====\nATTACHED FILES:\n\n### a.pdf\n```\nfoo\n```\n";
  assert.equal(stripAttachedFileBlock(full), "review the attached");
});

test("strip-attachments: removes block when ATTACHED FILES has no separator", () => {
  const full = "what is in this\nATTACHED FILES:\n### x.pdf\n```\nbody\n```\n";
  assert.equal(stripAttachedFileBlock(full), "what is in this");
});

test("strip-attachments: removes block when only a fenced filename header is present", () => {
  const full = "summarise\n\n### TradingAgents.pdf\n```\nrun checks\n```\n";
  assert.equal(stripAttachedFileBlock(full), "summarise");
});

test("strip-attachments: pass-through when no attachment block is present", () => {
  const plain = "review and summarize this pdf";
  assert.equal(stripAttachedFileBlock(plain), plain);
});

test("strip-attachments: empty / non-string defensive cases", () => {
  assert.equal(stripAttachedFileBlock(""), "");
  assert.equal(stripAttachedFileBlock(undefined), "");
  assert.equal(stripAttachedFileBlock(null), "");
});

// ─── REGRESSION: actionable-intent must not fire on attached PDF content ────
// 2026-05-05 second-order incident: user sent "please review and summarize
// this pdf" with attached PDF content. The PDF text contained "run", "check",
// "create", "file" etc. → userLikelyRequestedActionableToolWork returned true
// → corrective retry forced a tool call → blocked → meta-response cascade.

test("regression: 'review and summarize this pdf' alone is NOT actionable", () => {
  const m = [{ role: "user", content: "please review and summarize this pdf" }];
  assert.equal(userLikelyRequestedActionableToolWork(m), false);
});

test("regression: 'review and summarize this pdf' + attached PDF content stays NOT actionable", () => {
  // Realistic-looking financial-report excerpt: contains run / check / create
  // / file / tool — all of which match the actionable verb + target regexes.
  const fullMessage =
    "please review and summarize this pdf\n\n---\nATTACHED FILES:\n\n### TradingAgents.pdf\n```\n" +
    "The trading desk should run a systematic check of position sizing before " +
    "any new trades. Update the spreadsheet with current market data and verify " +
    "against the latest filings. Open a new position only after testing technical " +
    "levels. Create a watchlist with stop losses. Run weekly P/E checks. Verify " +
    "margin requirements against your broker's terms. The analyst will write a " +
    "detailed report and modify position sizes based on guidance.\n" +
    "```\n";
  const m = [{ role: "user", content: fullMessage }];
  // Pre-fix: this returned true (PDF content tripped the regex).
  // Post-fix: false (we strip the ATTACHED FILES block before matching).
  assert.equal(userLikelyRequestedActionableToolWork(m), false);
});

test("regression: actual actionable prompt + attached PDF stays TRUE", () => {
  // Sanity: the strip mustn't break legitimate cases. User is asking for a
  // real action against the file.
  const m = [
    {
      role: "user",
      content:
        "fix the bug in package.json then run the tests\n\n---\nATTACHED FILES:\n\n### log.md\n```\nirrelevant content\n```\n",
    },
  ];
  assert.equal(userLikelyRequestedActionableToolWork(m), true);
});

test("regression: disallow-files regex doesn't match attached PDF content", () => {
  // PDF body says "don't save the analysis to a file" — but user prompt is
  // benign. Disallow should NOT fire on attached text.
  const m = [
    {
      role: "user",
      content:
        "summarize\n\n---\nATTACHED FILES:\n\n### a.pdf\n```\nThe author advised: don't save the report to a file without review.\n```\n",
    },
  ];
  assert.equal(userExplicitlyDisallowsFileWrites(m), false);
});

test("regression: requests-files regex doesn't match attached PDF content", () => {
  // PDF body says "save as report.pdf" — but user prompt is benign.
  const m = [
    {
      role: "user",
      content:
        "summarize\n\n---\nATTACHED FILES:\n\n### a.pdf\n```\nInstruction: save as report.pdf when archiving.\n```\n",
    },
  ];
  assert.equal(userExplicitlyRequestsFileWrites(m), false);
});

// ─── looksLikeFileWritePolicyMetaResponse ───────────────────────────────────

test("file-write-meta: detects policy-explainer response", () => {
  const text = [
    "This is actually a safety feature, not a failure.",
    "Chat mode does not write files unless the user explicitly asks for a file artefact.",
  ].join(" ");
  assert.equal(looksLikeFileWritePolicyMetaResponse(text), true);
});

test("file-write-meta: ignores direct task answer text", () => {
  const text =
    "Here is the requested summary in chat: revenue slowed while margins improved quarter-over-quarter.";
  assert.equal(looksLikeFileWritePolicyMetaResponse(text), false);
});
