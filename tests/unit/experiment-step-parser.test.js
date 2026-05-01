const { test } = require("node:test");
const assert = require("node:assert");
const {
  parseStepSummary,
  extractMetricBlock,
  extractDeniedToolCalls,
  inferDecision,
} = require("../../lib/experiment-step-parser.js");

// ── parseStepSummary ────────────────────────────────────────

test("parseStepSummary: canonical block with explicit Done", () => {
  const raw = `Some preamble.

### Step summary
- **Did:** Ran pytest with the new flag
- **Observed:** 3 tests still fail
- **Next:** Pin numpy to 1.26 | **Done**
`;
  const out = parseStepSummary(raw);
  assert.equal(out.did, "Ran pytest with the new flag");
  assert.equal(out.observed, "3 tests still fail");
  assert.match(out.next, /Pin numpy to 1\.26/);
  assert.equal(out.done, true);
});

test("parseStepSummary: in-progress step (no Done)", () => {
  const raw = `### Step summary
- **Did:** installed deps via uv pip install -e .
- **Observed:** collection errors dropped from 6 to 2
- **Next:** investigate remaining 2 import failures
`;
  const out = parseStepSummary(raw);
  assert.equal(out.done, false);
  assert.match(out.did, /installed deps/);
  assert.match(out.next, /import failures/);
});

test("parseStepSummary: no heading, fields scattered in prose", () => {
  const raw = `Did: ran the tests
Observed: they pass
Next: nothing more to do — done.`;
  const out = parseStepSummary(raw);
  assert.equal(out.did, "ran the tests");
  assert.equal(out.observed, "they pass");
  assert.equal(out.done, true); // "done" inside Next triggers
});

test("parseStepSummary: missing fields default to null", () => {
  const out = parseStepSummary("### Step summary\n- **Did:** something only");
  assert.equal(out.did, "something only");
  assert.equal(out.observed, null);
  assert.equal(out.next, null);
  assert.equal(out.done, false);
});

test("parseStepSummary: handles asterisk bullets and CRLF", () => {
  const raw = "### Step summary\r\n* Did: A\r\n* Observed: B\r\n* Next: C\r\n";
  const out = parseStepSummary(raw);
  assert.equal(out.did, "A");
  assert.equal(out.observed, "B");
  assert.equal(out.next, "C");
});

test("parseStepSummary: empty / non-string input", () => {
  assert.deepEqual(parseStepSummary(""), {
    did: null,
    observed: null,
    next: null,
    done: false,
  });
  assert.deepEqual(parseStepSummary(null), {
    did: null,
    observed: null,
    next: null,
    done: false,
  });
  assert.deepEqual(parseStepSummary(undefined), {
    did: null,
    observed: null,
    next: null,
    done: false,
  });
});

test("parseStepSummary: trailing whitespace and stray markdown stripped", () => {
  const raw = `### Step summary
- **Did:**    \`pytest -q\`
- **Observed:** all green
- **Next:** **Done**
`;
  const out = parseStepSummary(raw);
  assert.equal(out.did, "`pytest -q`");
  assert.equal(out.observed, "all green");
  assert.equal(out.done, true);
});

test("parseStepSummary: bullet-prefixed Done (- **Done**) flips done flag", () => {
  // Regression for v1.6.29 dogfood: Mark complete sent "### Step summary\n- **Done**\n"
  // but the parser regex only allowed standalone or | -separated **Done**, not bullets.
  // Result: status stayed active, user spammed Mark complete out of frustration.
  const cases = [
    "### Step summary\n- **Done**\n",
    "### Step summary\n* **Done**",
    "### Step summary\n• Done",
    "### Step summary\n- Did: thing\n- Observed: x\n- Next: y\n- **Done**\n",
  ];
  for (const raw of cases) {
    const out = parseStepSummary(raw);
    assert.equal(
      out.done,
      true,
      `expected done:true for input ${JSON.stringify(raw)}`,
    );
  }
});

test("parseStepSummary: ignores Decision label without confusing field extraction", () => {
  const raw = `### Step summary
- **Did:** thing
- **Observed:** other thing
- **Next:** keep going
- **Decision:** iterate
`;
  const out = parseStepSummary(raw);
  assert.equal(out.did, "thing");
  assert.equal(out.next, "keep going");
});

// ── extractMetricBlock ──────────────────────────────────────

test("extractMetricBlock: well-formed numeric value", () => {
  const raw = 'Step\n```metric\n{"value": 42}\n```\n';
  assert.deepEqual(extractMetricBlock(raw), { value: 42 });
});

test("extractMetricBlock: explicit null", () => {
  const raw = '```metric\n{"value": null}\n```';
  assert.deepEqual(extractMetricBlock(raw), { value: null });
});

test("extractMetricBlock: missing block returns null", () => {
  assert.equal(extractMetricBlock("no fenced block here"), null);
});

test("extractMetricBlock: malformed JSON returns null (not throw)", () => {
  const raw = '```metric\n{"value": }\n```';
  assert.equal(extractMetricBlock(raw), null);
});

test("extractMetricBlock: missing value field returns null", () => {
  const raw = '```metric\n{"name": "foo"}\n```';
  assert.equal(extractMetricBlock(raw), null);
});

test("extractMetricBlock: non-numeric value returns null", () => {
  assert.equal(extractMetricBlock('```metric\n{"value": "high"}\n```'), null);
  assert.equal(extractMetricBlock('```metric\n{"value": NaN}\n```'), null);
});

test("extractMetricBlock: tolerates leading/trailing whitespace and case", () => {
  const raw = '```Metric\n   {"value": 7.5}   \n```';
  assert.deepEqual(extractMetricBlock(raw), { value: 7.5 });
});

// ── extractDeniedToolCalls ─────────────────────────────────

test("extractDeniedToolCalls: single denial without name", () => {
  const raw = "Tried foo. Command denied: Path outside experiment scope";
  assert.deepEqual(extractDeniedToolCalls(raw), [
    { name: "", reason: "Path outside experiment scope" },
  ]);
});

test("extractDeniedToolCalls: multiple denials in order", () => {
  const raw = `attempt 1
Command denied: Path outside experiment scope
ACTION: choose an in-scope path
attempt 2
Command denied (run_terminal_cmd): binary not in scope
ACTION: choose an allowed binary`;
  const out = extractDeniedToolCalls(raw);
  assert.equal(out.length, 2);
  assert.equal(out[0].reason, "Path outside experiment scope");
  assert.equal(out[1].name, "run_terminal_cmd");
  assert.equal(out[1].reason, "binary not in scope");
});

test("extractDeniedToolCalls: no denials → empty array", () => {
  assert.deepEqual(extractDeniedToolCalls("clean step"), []);
});

// ── inferDecision ───────────────────────────────────────────

test("inferDecision: done → keep", () => {
  assert.equal(inferDecision({ done: true }), "keep");
});

test("inferDecision: blocked / give up → discard", () => {
  assert.equal(inferDecision({ next: "blocked on missing creds" }), "discard");
  assert.equal(inferDecision({ next: "I'll give up and ask user" }), "discard");
  assert.equal(inferDecision({ next: "unable to proceed" }), "discard");
});

test("inferDecision: 2+ denials in one turn → discard", () => {
  assert.equal(
    inferDecision({
      next: "try again",
      denials: [{ reason: "x" }, { reason: "y" }],
    }),
    "discard",
  );
});

test("inferDecision: explicit **Decision:** in raw text wins", () => {
  assert.equal(
    inferDecision({ done: true, rawSummary: "**Decision:** discard" }),
    "discard",
  );
  assert.equal(
    inferDecision({ next: "stuck", rawSummary: "**Decision:** keep" }),
    "keep",
  );
});

test("inferDecision: default is iterate", () => {
  assert.equal(
    inferDecision({ next: "tweak the regex and re-run" }),
    "iterate",
  );
  assert.equal(inferDecision({}), "iterate");
});
