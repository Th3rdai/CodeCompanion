/**
 * CTXFIX Phase 3 — unit coverage for lib/tool-result-artifacts.js.
 *
 * Asserts the contract the chat handler depends on:
 *   - sanitizeConvIdForFilename — deterministic, same output for the writer
 *     (chat handler) and the GC sweepers (history.js + server.js startup).
 *   - generateReqSuffix — produces unique suffixes per call.
 *   - maybeExternalizeToolOutput:
 *       * under cap → content unchanged.
 *       * over cap + flag on + projectFolder → file written, placeholder returned.
 *       * over cap + (flag off OR no projectFolder) → tail-truncated with hint.
 *       * cumulativeRef is read, not written by the helper.
 *   - First write creates `.codecompanion/.gitignore` with `tool-results/`.
 *   - gcOlderThan and deleteForConversation behave as documented.
 */

const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  sanitizeConvIdForFilename,
  generateReqSuffix,
  maybeExternalizeToolOutput,
  gcOlderThan,
  deleteForConversation,
  toolResultsDir,
  TOOL_RESULTS_SUBDIR,
} = require("../../lib/tool-result-artifacts.js");

function tmpProjectFolder(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `cc-tra-${label}-`));
}

test("sanitizeConvIdForFilename collapses unsafe chars and caps at 64", () => {
  assert.equal(sanitizeConvIdForFilename("abc-123_XY"), "abc-123_XY");
  // `../../etc/passwd` → 6 leading underscores (`..`, `/`, `..`, `/` = 6 unsafe chars), `etc`, `_`, `passwd`.
  assert.equal(
    sanitizeConvIdForFilename("../../etc/passwd"),
    "______etc_passwd",
  );
  assert.equal(
    sanitizeConvIdForFilename("with spaces and !@#"),
    "with_spaces_and____",
  );
  // Length cap: 64.
  const huge = "x".repeat(200);
  assert.equal(sanitizeConvIdForFilename(huge).length, 64);
  // Empty / null falls back to a generated id (still safe).
  const fallback = sanitizeConvIdForFilename(null);
  assert.match(fallback, /^req-\d+-[a-z0-9]+$/);
});

test("generateReqSuffix is unique across calls", () => {
  const seen = new Set();
  for (let i = 0; i < 1000; i++) {
    const s = generateReqSuffix();
    assert.ok(s, "suffix is non-empty");
    assert.ok(!seen.has(s), `duplicate suffix at iteration ${i}: ${s}`);
    seen.add(s);
  }
});

test("maybeExternalizeToolOutput returns content unchanged when under cap", () => {
  const cumulativeRef = { value: 0 };
  const out = maybeExternalizeToolOutput("small payload", {
    config: {
      cumulativeToolOutputMaxChars: 100,
      externalizeToolOutput: true,
      projectFolder: "/tmp",
    },
    conversationId: "c1",
    reqSuffix: "abcd",
    roundIdx: 0,
    cumulativeRef,
  });
  assert.equal(out, "small payload");
  // Helper must NOT mutate cumulativeRef.
  assert.equal(cumulativeRef.value, 0);
});

test("maybeExternalizeToolOutput externalizes when over cap + flag on + projectFolder set", () => {
  const projectFolder = tmpProjectFolder("ext");
  try {
    const cumulativeRef = { value: 80 }; // close to cap already
    const huge = "X".repeat(200);
    const out = maybeExternalizeToolOutput(huge, {
      config: {
        cumulativeToolOutputMaxChars: 100,
        externalizeToolOutput: true,
        projectFolder,
      },
      conversationId: "conv-test",
      reqSuffix: "abcdef",
      roundIdx: 2,
      cumulativeRef,
    });
    assert.match(out, /Tool output saved to/);
    assert.match(out, /codecompanion_read_file/);
    assert.match(out, /\.codecompanion\/tool-results\/conv-test-abcdef-2\.txt/);

    const dir = toolResultsDir(projectFolder);
    const files = fs.readdirSync(dir);
    assert.equal(files.length, 1);
    assert.equal(files[0], "conv-test-abcdef-2.txt");
    assert.equal(fs.readFileSync(path.join(dir, files[0]), "utf8"), huge);

    // .gitignore was written next to the tool-results dir on first creation.
    const gi = fs.readFileSync(
      path.join(projectFolder, ".codecompanion", ".gitignore"),
      "utf8",
    );
    assert.match(gi, /^tool-results\/$/m);

    // Helper does NOT mutate cumulativeRef — caller is sole writer.
    assert.equal(cumulativeRef.value, 80);
  } finally {
    fs.rmSync(projectFolder, { recursive: true, force: true });
  }
});

test("maybeExternalizeToolOutput falls back to tail-truncate when flag is off", () => {
  const projectFolder = tmpProjectFolder("flagoff");
  try {
    const huge = "Y".repeat(20_000);
    const out = maybeExternalizeToolOutput(huge, {
      config: {
        cumulativeToolOutputMaxChars: 100,
        externalizeToolOutput: false, // flag off — must NOT write a file
        projectFolder,
      },
      conversationId: "c1",
      reqSuffix: "f00d",
      roundIdx: 0,
      cumulativeRef: { value: 0 },
    });
    assert.match(
      out,
      /\[truncated — set Settings → Project folder to externalize\]/,
    );
    // tail-truncate keeps the LAST 5000 chars.
    assert.ok(out.length < huge.length, "truncated below original");
    assert.equal(fs.existsSync(toolResultsDir(projectFolder)), false);
  } finally {
    fs.rmSync(projectFolder, { recursive: true, force: true });
  }
});

test("maybeExternalizeToolOutput falls back to tail-truncate when no projectFolder", () => {
  const huge = "Z".repeat(20_000);
  const out = maybeExternalizeToolOutput(huge, {
    config: {
      cumulativeToolOutputMaxChars: 100,
      externalizeToolOutput: true,
      projectFolder: "", // no project folder
    },
    conversationId: "c1",
    reqSuffix: "abcd",
    roundIdx: 0,
    cumulativeRef: { value: 0 },
  });
  assert.match(
    out,
    /\[truncated — set Settings → Project folder to externalize\]/,
  );
});

test("gcOlderThan removes only files older than the cutoff", () => {
  const projectFolder = tmpProjectFolder("gc");
  try {
    // Force-create the tool-results dir.
    const out = maybeExternalizeToolOutput("a".repeat(200), {
      config: {
        cumulativeToolOutputMaxChars: 1,
        externalizeToolOutput: true,
        projectFolder,
      },
      conversationId: "old",
      reqSuffix: "old1",
      roundIdx: 0,
      cumulativeRef: { value: 0 },
    });
    assert.match(out, /tool-results\/old-old1-0\.txt/);

    const dir = toolResultsDir(projectFolder);
    const oldFile = path.join(dir, "old-old1-0.txt");
    const recentFile = path.join(dir, "recent-r1-0.txt");
    fs.writeFileSync(recentFile, "recent");
    // Backdate the "old" file to 30 days ago.
    const thirtyDaysAgo = (Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(oldFile, thirtyDaysAgo, thirtyDaysAgo);

    const removed = gcOlderThan(projectFolder); // default 7d
    assert.equal(removed, 1);
    assert.equal(fs.existsSync(oldFile), false);
    assert.equal(fs.existsSync(recentFile), true);
  } finally {
    fs.rmSync(projectFolder, { recursive: true, force: true });
  }
});

test("deleteForConversation removes only files for that conversation", () => {
  const projectFolder = tmpProjectFolder("delconv");
  try {
    const dir = toolResultsDir(projectFolder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "conv-A-suf1-0.txt"), "a1");
    fs.writeFileSync(path.join(dir, "conv-A-suf2-1.txt"), "a2");
    fs.writeFileSync(path.join(dir, "conv-B-suf1-0.txt"), "b1");
    fs.writeFileSync(path.join(dir, "other-stuff.txt"), "noise");

    const removed = deleteForConversation(projectFolder, "conv-A");
    assert.equal(removed, 2);
    assert.equal(fs.existsSync(path.join(dir, "conv-A-suf1-0.txt")), false);
    assert.equal(fs.existsSync(path.join(dir, "conv-A-suf2-1.txt")), false);
    assert.equal(fs.existsSync(path.join(dir, "conv-B-suf1-0.txt")), true);
    assert.equal(fs.existsSync(path.join(dir, "other-stuff.txt")), true);
  } finally {
    fs.rmSync(projectFolder, { recursive: true, force: true });
  }
});

test("deleteForConversation prefix-match safety: conv-A does NOT sweep conv-AB", () => {
  const projectFolder = tmpProjectFolder("safety");
  try {
    const dir = toolResultsDir(projectFolder);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "conv-A-suf-0.txt"), "a");
    fs.writeFileSync(path.join(dir, "conv-AB-suf-0.txt"), "ab"); // similar prefix
    const removed = deleteForConversation(projectFolder, "conv-A");
    assert.equal(removed, 1, "must not sweep conv-AB on a conv-A delete");
    assert.equal(fs.existsSync(path.join(dir, "conv-AB-suf-0.txt")), true);
  } finally {
    fs.rmSync(projectFolder, { recursive: true, force: true });
  }
});

test("TOOL_RESULTS_SUBDIR is `.codecompanion/tool-results`", () => {
  // Locked so other docs / runtime assumptions stay in sync.
  assert.equal(
    TOOL_RESULTS_SUBDIR,
    path.join(".codecompanion", "tool-results"),
  );
});
