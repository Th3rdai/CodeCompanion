const { test } = require("node:test");
const assert = require("node:assert");

const { buildEmptyAssistantReplyMessage } = require("../../routes/chat");

test("empty assistant reply message explains the model returned no text", () => {
  const message = buildEmptyAssistantReplyMessage("gemma4:latest");

  assert.match(message, /did not get any text back from gemma4:latest/i);
  assert.match(message, /request reached Code Companion and Ollama/i);
  assert.match(message, /returned an empty completion/i);
  assert.match(message, /try again/i);
  assert.match(message, /switch from Auto/i);
});
