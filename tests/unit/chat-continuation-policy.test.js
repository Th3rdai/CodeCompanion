/**
 * Unit tests for lib/chat-continuation-policy.js
 */

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  isExplicitTaskComplete,
  needsUserClarity,
  shouldContinueAgentWork,
  userRequestedSustainedWork,
  buildToolResultFollowUpMessage,
} = require("../../lib/chat-continuation-policy");

test("isExplicitTaskComplete: TASK_COMPLETE line", () => {
  assert.equal(isExplicitTaskComplete("Done.\n\nTASK_COMPLETE"), true);
});

test("isExplicitTaskComplete: rhetorical question is not complete", () => {
  assert.equal(
    isExplicitTaskComplete("Should I continue with the next file?"),
    false,
  );
});

test("needsUserClarity: NEEDS_USER_INPUT prefix", () => {
  assert.equal(
    needsUserClarity("NEEDS_USER_INPUT: Which database should I use?"),
    true,
  );
});

test("needsUserClarity: trailing question alone is not a stop", () => {
  assert.equal(needsUserClarity("Want me to add tests next?"), false);
});

test("shouldContinueAgentWork: empty means keep going", () => {
  assert.equal(shouldContinueAgentWork(""), true);
});

test("shouldContinueAgentWork: stops on clarity or complete", () => {
  assert.equal(shouldContinueAgentWork("NEEDS_USER_INPUT: pick A or B"), false);
  assert.equal(shouldContinueAgentWork("All set.\nTASK_COMPLETE"), false);
  assert.equal(shouldContinueAgentWork("Created index.html."), true);
});

test("userRequestedSustainedWork detects until-done phrasing", () => {
  assert.equal(
    userRequestedSustainedWork([
      { role: "user", content: "Implement everything until done" },
    ]),
    true,
  );
  assert.equal(
    userRequestedSustainedWork([
      {
        role: "user",
        content:
          "Fix the app so the agent can continue autonomously without asking me",
      },
    ]),
    true,
  );
  assert.equal(
    userRequestedSustainedWork([{ role: "user", content: "What is React?" }]),
    false,
  );
});

test("buildToolResultFollowUpMessage: actionable vs read-only", () => {
  const results = "ok";
  assert.match(
    buildToolResultFollowUpMessage(results, { actionableIntent: true }),
    /CONTINUE WORK/,
  );
  assert.match(
    buildToolResultFollowUpMessage(results, { actionableIntent: false }),
    /Summarize these results/,
  );
});
