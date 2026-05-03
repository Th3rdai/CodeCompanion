const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const {
  SYSTEM_FOLDER_ID,
  initHistoryFolders,
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
} = require("../../lib/history-folders");

function makeTmpRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "cc-history-folders-"));
}

test("history folders: init seeds immutable system inbox", () => {
  const root = makeTmpRoot();
  initHistoryFolders(root);
  const folders = listFolders();
  assert.ok(Array.isArray(folders));
  const inbox = folders.find((f) => f.id === SYSTEM_FOLDER_ID);
  assert.ok(inbox);
  assert.equal(inbox.name, "Inbox");
  assert.equal(inbox.system, true);
});

test("history folders: create/update/delete lifecycle for user folder", () => {
  const root = makeTmpRoot();
  initHistoryFolders(root);

  const created = createFolder({ name: "Client Work" });
  assert.equal(created.id, "client-work");
  assert.equal(created.system, false);

  const updated = updateFolder(created.id, {
    name: "Client Alpha",
    collapsed: true,
  });
  assert.equal(updated.name, "Client Alpha");
  assert.equal(updated.collapsed, true);

  const deleted = deleteFolder(created.id);
  assert.equal(deleted.id, "client-work");
  assert.equal(listFolders().some((f) => f.id === created.id), false);
});

test("history folders: rejects duplicate names and deleting system folder", () => {
  const root = makeTmpRoot();
  initHistoryFolders(root);
  createFolder({ name: "Ops" });

  assert.throws(() => createFolder({ name: "ops" }), /already exists/i);
  assert.throws(() => deleteFolder(SYSTEM_FOLDER_ID), /cannot be deleted/i);
});

