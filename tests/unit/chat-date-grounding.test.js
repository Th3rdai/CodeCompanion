/**
 * Regression lock: chat system prompt must inject host date + time + timezone.
 * Without this, models hallucinate dates from training data or echo stale
 * dates from earlier conversation history. The user reported the agent
 * confidently stating wrong dates — this test prevents the date-grounding
 * line from being silently removed.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { formatHostTimeForPrompt } = require("../../lib/host-time.js");

const HANDLER_PATH = path.join(
  __dirname,
  "..",
  "..",
  "lib",
  "chat-post-handler.js",
);

test("chat-post-handler injects host time context into the system prompt", () => {
  const src = fs.readFileSync(HANDLER_PATH, "utf8");

  assert.match(
    src,
    /const \{ formatHostTimeForPrompt \} = require\("\.\.\/lib\/host-time"\)/,
    "handler must import formatHostTimeForPrompt from lib/host-time",
  );
  assert.match(
    src,
    /const dateContext = formatHostTimeForPrompt\(\)/,
    "dateContext must come from formatHostTimeForPrompt()",
  );
  assert.match(
    src,
    /let leadIn = dateContext/,
    "leadIn must start with dateContext so every mode (with or without agent tools) gets date grounding",
  );

  // Regression: an earlier version of this patch reassigned `leadIn = "..."`
  // inside the `if (hasAgentTools)` branch, clobbering dateContext for every
  // chat (because chat always has agent tools). Inside that block, leadIn must
  // ONLY be appended to (`+=`), never replaced (`=`).
  const agentBranch = src.match(/if \(hasAgentTools\) \{[\s\S]*?\n {2}\}\n/);
  assert.ok(agentBranch, "Could not locate hasAgentTools block in handler");
  assert.ok(
    !/^\s*leadIn\s*=[^=+]/m.test(agentBranch[0]),
    "Inside `if (hasAgentTools)`, leadIn must be appended (+=), never reassigned — reassignment clobbers dateContext",
  );
});

test("formatHostTimeForPrompt produces CURRENT_HOST_TIME line at runtime", () => {
  const line = formatHostTimeForPrompt().trimEnd();
  assert.match(
    line,
    /^CURRENT_HOST_TIME: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \(.+; UTC calendar date \d{4}-\d{2}-\d{2}; instant \d{4}-\d{2}-\d{2}T[\d:.]+Z\)$/,
  );
});
