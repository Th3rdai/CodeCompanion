/**
 * CTXFIX Phase 3 — wiring guard for lib/chat-post-handler.js.
 *
 * Source-level assertions that lock the integration points the spec calls
 * out. A full end-to-end test would need a live MCP server + tool round;
 * the helper itself is covered by tests/unit/tool-result-artifacts.test.js.
 *
 * Locks:
 *   1. handler imports maybeExternalizeToolOutput, generateReqSuffix, and
 *      gcOlderThan (renamed locally) from lib/tool-result-artifacts.
 *   2. cumulativeRef + reqSuffix are set up once per request (not per round).
 *   3. externalizeToolOutput is invoked BEFORE wrapping (so the wrapper
 *      text "Tool results:\n…" stays around either real stdout or a
 *      placeholder).
 *   4. The wrapper feeds `externalizedToolResults`, NOT raw `toolResults`, to
 *      the model — inline in the browser branch, and via
 *      buildToolResultFollowUpMessage (lib/chat-continuation-policy.js) in the
 *      non-browser branch.
 *   5. toolContextForHistory.push uses `externalizedToolResults` so saved
 *      history doesn't drift from the prompt.
 *   6. caller (handler) is sole writer of cumulativeRef.value via `+=`.
 *   7. end-of-request GC is scheduled via setImmediate on res close+finish.
 */

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const HANDLER_PATH = path.resolve(__dirname, "../../lib/chat-post-handler.js");
const SRC = fs.readFileSync(HANDLER_PATH, "utf8");

test("handler imports the Phase 3 helpers from tool-result-artifacts", () => {
  assert.match(
    SRC,
    /require\(["']\.\.\/lib\/tool-result-artifacts["']\)/,
    "expected require('../lib/tool-result-artifacts')",
  );
  assert.match(SRC, /generateReqSuffix/);
  assert.match(SRC, /maybeExternalizeToolOutput/);
  assert.match(SRC, /gcOlderThan/);
});

test("cumulativeRef and reqSuffix are set up once at handler entry (not per round)", () => {
  // Both must appear before the for-loop that opens the tool round.
  const refIdx = SRC.indexOf("const cumulativeRef = { value: 0 }");
  const suffixIdx = SRC.indexOf("const reqSuffix = generateReqSuffix()");
  const roundLoopIdx = SRC.indexOf("for (let round = 0; round < MAX_ROUNDS");
  assert.ok(refIdx > 0, "expected cumulativeRef declaration");
  assert.ok(suffixIdx > 0, "expected reqSuffix declaration");
  assert.ok(roundLoopIdx > 0, "expected the round loop");
  assert.ok(
    refIdx < roundLoopIdx,
    "cumulativeRef must be declared BEFORE the round loop",
  );
  assert.ok(
    suffixIdx < roundLoopIdx,
    "reqSuffix must be declared BEFORE the round loop",
  );
});

test("externalization runs BEFORE the toolResultMsg wrapper, not after", () => {
  const externalizeIdx = SRC.indexOf(
    "const externalizedToolResults = maybeExternalizeToolOutput",
  );
  const wrapperIdx = SRC.indexOf("const toolResultMsg = {");
  assert.ok(externalizeIdx > 0, "expected externalizedToolResults declaration");
  assert.ok(wrapperIdx > 0, "expected toolResultMsg declaration");
  assert.ok(
    externalizeIdx < wrapperIdx,
    "externalize must precede the toolResultMsg wrapper so the wrapper text is preserved",
  );
});

test("toolResultMsg wrapper templates use externalizedToolResults, not raw toolResults", () => {
  const wrapperBlock = SRC.slice(
    SRC.indexOf("const toolResultMsg = {"),
    SRC.indexOf("loopMessages.push(toolResultMsg);"),
  );
  assert.ok(wrapperBlock.length > 0, "expected to slice the wrapper block");
  // Both branches must feed the EXTERNALIZED var into the prompt: the browser
  // branch inlines `${externalizedToolResults}`; the non-browser branch was
  // extracted into buildToolResultFollowUpMessage (lib/chat-continuation-policy.js)
  // and passes `externalizedToolResults` as its first argument. Either way the
  // externalized value — never raw toolResults — reaches the model.
  const inlineHits =
    wrapperBlock.split("${externalizedToolResults}").length - 1;
  const delegatesExternalized = wrapperBlock.includes(
    "buildToolResultFollowUpMessage(externalizedToolResults",
  );
  assert.ok(
    inlineHits >= 1 && delegatesExternalized,
    `wrapper must inline externalizedToolResults (browser branch) AND pass it to buildToolResultFollowUpMessage (other branch); inline=${inlineHits}, delegates=${delegatesExternalized}`,
  );
  // Raw `${toolResults}` must NOT appear in the wrapper templates.
  assert.equal(
    wrapperBlock.includes("${toolResults}"),
    false,
    "wrapper must use externalizedToolResults, not the raw toolResults",
  );
});

test("buildToolResultFollowUpMessage helper uses externalizedToolResults, not raw toolResults", () => {
  // Lock #4's intent moved into this helper when the non-browser follow-up was
  // extracted; assert the externalized value is what reaches the prompt there.
  const POLICY_SRC = fs.readFileSync(
    path.resolve(__dirname, "../../lib/chat-continuation-policy.js"),
    "utf8",
  );
  const fnStart = POLICY_SRC.indexOf("function buildToolResultFollowUpMessage");
  assert.ok(
    fnStart > 0,
    "expected buildToolResultFollowUpMessage in lib/chat-continuation-policy.js",
  );
  const rest = POLICY_SRC.slice(fnStart);
  const nextDef = rest.search(/\n(function |module\.exports)/);
  const fnBlock = nextDef > 0 ? rest.slice(0, nextDef) : rest;
  const externalizedHits =
    fnBlock.split("${externalizedToolResults}").length - 1;
  assert.ok(
    externalizedHits >= 2,
    `helper must template externalizedToolResults in both branches, got ${externalizedHits}`,
  );
  assert.equal(
    fnBlock.includes("${toolResults}"),
    false,
    "helper must not reintroduce raw toolResults",
  );
});

test("toolContextForHistory uses externalizedToolResults so saved history mirrors the prompt", () => {
  // Find the [Tool: …] history-push and check what variable it interpolates.
  const historyPushMatch = SRC.match(
    /toolContextForHistory\.push\(\{[\s\S]*?\[Tool: \$\{[\s\S]*?\}\]\\n\$\{(\w+)\}/,
  );
  assert.ok(
    historyPushMatch,
    "expected to find toolContextForHistory.push with [Tool: …] template",
  );
  assert.equal(
    historyPushMatch[1],
    "externalizedToolResults",
    "history must interpolate externalizedToolResults so it matches the prompt",
  );
});

test("caller (handler) is sole writer of cumulativeRef.value", () => {
  // The helper module reads cumulativeRef.value but never writes it.
  const ARTIFACTS_SRC = fs.readFileSync(
    path.resolve(__dirname, "../../lib/tool-result-artifacts.js"),
    "utf8",
  );
  // Allow `cumulativeRef.value` reads (e.g. `cumulativeRef.value` in expression),
  // but reject any assignment (`cumulativeRef.value =` or `+= ` or `++`).
  assert.equal(
    /cumulativeRef\.value\s*=/.test(ARTIFACTS_SRC),
    false,
    "tool-result-artifacts must not assign to cumulativeRef.value",
  );
  assert.equal(
    /cumulativeRef\.value\s*\+=/.test(ARTIFACTS_SRC),
    false,
    "tool-result-artifacts must not increment cumulativeRef.value",
  );
  // The handler must own at least one `+=` write.
  assert.match(
    SRC,
    /cumulativeRef\.value\s*\+=\s*externalizedToolResults\.length/,
    "handler must own the cumulativeRef.value += write",
  );
});

test("end-of-request GC is scheduled via setImmediate on res close+finish", () => {
  // Both lifecycle hooks must wire the GC scheduler.
  const closeHook = SRC.match(
    /res\.once\(["']close["'], _scheduleToolResultsGc\)/,
  );
  const finishHook = SRC.match(
    /res\.once\(["']finish["'], _scheduleToolResultsGc\)/,
  );
  assert.ok(closeHook, "expected res.once('close', _scheduleToolResultsGc)");
  assert.ok(finishHook, "expected res.once('finish', _scheduleToolResultsGc)");
  // And the scheduler must use setImmediate (so it doesn't block the response).
  assert.match(
    SRC,
    /setImmediate\(\s*\(\)\s*=>\s*\{[\s\S]*?gcToolResultsOlderThan\(folder\)/,
  );
});
