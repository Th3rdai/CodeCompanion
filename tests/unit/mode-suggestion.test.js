/**
 * Unit tests for the soft mode-suggestion heuristic used by the chat composer.
 * Verifies common keyword patterns route to the right mode and that:
 *   - already-on-target-mode produces no suggestion (no churn)
 *   - short drafts produce no suggestion (avoids flicker)
 *   - generic chat input produces no suggestion
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

// Run the ES module via dynamic import so the unit test stays in CJS.
let suggestMode;
test.before(async () => {
  ({ suggestMode } = await import("../../src/lib/mode-suggestion.js"));
});

const cases = [
  // [draft, currentMode, expectedSuggestion]
  ["Please review my pull request for issues we should fix.", "chat", "review"],
  [
    "Run a security review on this — look for OWASP issues and SQL injection.",
    "chat",
    "pentest",
  ],
  [
    "Draw me a flowchart of the authentication architecture diagram.",
    "chat",
    "diagram",
  ],
  [
    "Find the bugs in this function and tell me why it isn't working.",
    "chat",
    "bugs",
  ],
  [
    "Refactor this code so it is easier to read and maintain over time.",
    "chat",
    "refactor",
  ],
  [
    "Walk me through this code and how the function works step by step.",
    "chat",
    "explain",
  ],
  [
    "Generate a validate.md command for this monorepo so CI can run it.",
    "chat",
    "validate",
  ],
  [
    "Score my prompt and tell me how to improve it for clarity and specificity.",
    "chat",
    "prompting",
  ],
  // Already on target mode → no suggestion
  ["Please review my pull request for issues we should fix.", "review", null],
  // Generic chat → no suggestion
  ["What's the weather today and how should I plan my run?", "chat", null],
  // Too short → no suggestion (debounce)
  ["review", "chat", null],
];

for (const [draft, currentMode, expected] of cases) {
  test(`suggestMode: "${draft.slice(0, 40)}..." (${currentMode}) → ${expected}`, () => {
    assert.equal(suggestMode(draft, currentMode), expected);
  });
}

test("suggestMode: empty/non-string input safely returns null", () => {
  assert.equal(suggestMode("", "chat"), null);
  assert.equal(suggestMode(null, "chat"), null);
  assert.equal(suggestMode(undefined, "chat"), null);
});

test("suggestMode: pentest beats review when both could match", () => {
  // Both 'security review' (pentest) and 'review my code' (review) keywords are present.
  // Order in MODE_PATTERNS puts pentest first, so it wins — that's intentional.
  assert.equal(
    suggestMode(
      "Do a security review of this code and check for OWASP issues now.",
      "chat",
    ),
    "pentest",
  );
});
