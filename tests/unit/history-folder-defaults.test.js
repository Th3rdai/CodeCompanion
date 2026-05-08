const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  initHistory,
  saveConversation,
  listConversations,
  getConversation,
} = require("../../lib/history");

function makeTmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cc-history-defaults-"));
}

test("history defaults folderId to inbox on save/list/get", () => {
  const root = makeTmpRoot();
  initHistory(root);

  const id = saveConversation({
    title: "No folder payload",
    mode: "chat",
    model: "llama3.2",
    messages: [{ role: "user", content: "hello" }],
  });

  const listed = listConversations().find((c) => c.id === id);
  assert.ok(listed);
  assert.equal(listed.folderId, "inbox");

  const loaded = getConversation(id);
  assert.equal(loaded.folderId, "inbox");
});

test("history normalizes legacy file without folderId as inbox", () => {
  const root = makeTmpRoot();
  initHistory(root);
  const historyDir = path.join(root, "history");
  const id = "legacy-chat";
  fs.writeFileSync(
    path.join(historyDir, `${id}.json`),
    JSON.stringify({
      id,
      title: "Legacy",
      mode: "chat",
      model: "llama3.2",
      messages: [],
      createdAt: new Date().toISOString(),
    }),
  );

  const listed = listConversations().find((c) => c.id === id);
  assert.ok(listed);
  assert.equal(listed.folderId, "inbox");
  assert.equal(Object.prototype.hasOwnProperty.call(listed, "title"), true);
  assert.equal(Object.prototype.hasOwnProperty.call(listed, "model"), true);
});
