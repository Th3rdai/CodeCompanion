// Unit tests for the failed-install loop guard added to electron/updater.js.
// These cover the pure helpers; the IPC wiring is exercised manually because
// it requires a real Electron BrowserWindow and `electron-updater` running
// against a real GitHub feed.

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Minimal `electron` shim so requiring electron/updater.js doesn't blow up
// when the test runs outside an Electron environment. Stub lives in tmpdir
// so tests don't drop a fixture file inside tests/unit/.
const _stubPath = path.join(os.tmpdir(), `cc-electron-stub-${process.pid}.js`);
fs.writeFileSync(
  _stubPath,
  "module.exports = { ipcMain: { handle: () => {} }, app: { isPackaged: false, getVersion: () => '1.0.0' } };",
);
const Module = require("module");
const _origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "electron") return _stubPath;
  return _origResolve.call(this, request, ...rest);
};
process.on("exit", () => {
  try {
    fs.unlinkSync(_stubPath);
  } catch {
    /* ignore */
  }
});

const {
  readUpdateAttemptState,
  writeUpdateAttemptState,
  clearUpdateAttemptState,
  isCodeSignatureError,
} = require("../../electron/updater.js");

function tmpDir() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "cc-updater-test-"));
  return d;
}

test("update attempt state: write -> read round-trip", () => {
  const d = tmpDir();
  writeUpdateAttemptState(d, {
    targetVersion: "1.6.20",
    attemptedAt: "2026-04-30T22:00:00Z",
  });
  const got = readUpdateAttemptState(d);
  assert.equal(got.targetVersion, "1.6.20");
  assert.equal(got.attemptedAt, "2026-04-30T22:00:00Z");
});

test("update attempt state: read returns null when file missing", () => {
  const d = tmpDir();
  assert.equal(readUpdateAttemptState(d), null);
});

test("update attempt state: clear removes the file", () => {
  const d = tmpDir();
  writeUpdateAttemptState(d, { targetVersion: "1.6.20" });
  assert.ok(readUpdateAttemptState(d) !== null);
  clearUpdateAttemptState(d);
  assert.equal(readUpdateAttemptState(d), null);
});

test("update attempt state: clear is a no-op when file already absent", () => {
  const d = tmpDir();
  // Should not throw.
  clearUpdateAttemptState(d);
  assert.equal(readUpdateAttemptState(d), null);
});

test("update attempt state: read returns null on malformed JSON", () => {
  const d = tmpDir();
  fs.writeFileSync(path.join(d, ".update-attempt.json"), "not-json {{{");
  assert.equal(readUpdateAttemptState(d), null);
});

test("update attempt state: write/read tolerate undefined dataDir", () => {
  // Both should be no-ops rather than throw.
  writeUpdateAttemptState(undefined, { targetVersion: "x" });
  assert.equal(readUpdateAttemptState(undefined), null);
  clearUpdateAttemptState(undefined);
});

// ── isCodeSignatureError covers the strings Squirrel.Mac actually emits ─────

test("isCodeSignatureError: matches Squirrel 'did not pass validation' error", () => {
  const err = new Error(
    "Code signature at URL file:///.../update.QLFohwu/Code Companion.app/ did not pass validation: code failed to satisfy specified code requirement(s)",
  );
  assert.equal(isCodeSignatureError(err), true);
});

test("isCodeSignatureError: matches the bare 'code requirement' phrasing", () => {
  assert.equal(
    isCodeSignatureError(
      new Error("code failed to satisfy specified code requirement(s)"),
    ),
    true,
  );
});

test("isCodeSignatureError: matches plain string input (no Error wrapper)", () => {
  assert.equal(
    isCodeSignatureError("Code signature at URL ... did not pass validation"),
    true,
  );
});

test("isCodeSignatureError: does not match unrelated errors", () => {
  assert.equal(
    isCodeSignatureError(new Error("Network request failed")),
    false,
  );
  assert.equal(isCodeSignatureError(new Error("ENOSPC: no space left")), false);
  assert.equal(isCodeSignatureError(null), false);
  assert.equal(isCodeSignatureError(undefined), false);
});
