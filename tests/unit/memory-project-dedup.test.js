const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  initMemory,
  addMemory,
  getMemories,
  searchMemories,
  _deduplicateAndAdd,
  _projectIdentityName,
} = require("../../lib/memory.js");

function freshMemory() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mem-projdedup-"));
  initMemory(dir);
  return dir;
}
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}
const vec = (seed) => Array.from({ length: 8 }, (_, i) => Math.sin(seed + i));

describe("_projectIdentityName", () => {
  test("normalizes the project name from the identity template", () => {
    assert.equal(
      _projectIdentityName("Project: Code Companion — Stack: Electron — x"),
      "codecompanion",
    );
    assert.equal(
      _projectIdentityName("Project: PCI-ASSISTANT — Stack: FastAPI"),
      "pciassistant",
    );
    // hyphen separator variant
    assert.equal(
      _projectIdentityName("Project: Snake Game - Stack: JS"),
      "snakegame",
    );
  });
  test("returns null for non-identity content", () => {
    assert.equal(_projectIdentityName("User prefers dark mode"), null);
    assert.equal(_projectIdentityName(""), null);
    assert.equal(_projectIdentityName(null), null);
  });
});

describe("project-identity dedup-on-write", () => {
  test("same project name updates the existing identity instead of adding (across stack + key drift)", () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "project",
        content: "Project: Foo — Stack: Electron + React",
        source: null,
        projectKey: "foo",
        embedding: vec(1),
        embeddingModel: "m",
        confidence: 0.8,
      });
      // New session: different stack guess + drifted projectKey, low embedding similarity.
      _deduplicateAndAdd(
        "project",
        "Project: Foo — Stack: Express + Vite, Node",
        null,
        vec(900), // deliberately dissimilar so the cosine path would NOT match
        "m",
        0.8,
        500,
        "foo-app",
      );
      const projects = getMemories().filter((m) => m.type === "project");
      assert.equal(projects.length, 1, "no duplicate identity created");
      assert.equal(projects[0].content, "Project: Foo — Stack: Express + Vite, Node");
      assert.equal(projects[0].projectKey, "foo-app", "projectKey consolidated");
      assert.ok(projects[0].confidence > 0.8, "confidence bumped");
    } finally {
      cleanup(dir);
    }
  });

  test("a different project name adds a new identity", () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "project",
        content: "Project: Foo — Stack: A",
        source: null,
        projectKey: "foo",
        embedding: vec(1),
        embeddingModel: "m",
        confidence: 0.8,
      });
      _deduplicateAndAdd(
        "project",
        "Project: Bar — Stack: B",
        null,
        vec(2),
        "m",
        0.8,
        500,
        "bar",
      );
      const projects = getMemories().filter((m) => m.type === "project");
      assert.equal(projects.length, 2, "distinct project kept separate");
    } finally {
      cleanup(dir);
    }
  });

  test("project-identity in-place update invalidates warmed index cache", () => {
    const dir = freshMemory();
    try {
      const emb = vec(1);
      addMemory({
        type: "project",
        content: "Project: Foo — Stack: Electron",
        source: null,
        projectKey: "foo",
        embedding: emb,
        embeddingModel: "m",
        confidence: 0.8,
      });

      searchMemories(emb, 10, 0, {
        types: ["project"],
        embeddingModel: "m",
        indexCacheEnabled: true,
      });

      _deduplicateAndAdd(
        "project",
        "Project: Foo — Stack: Express + Vite",
        null,
        vec(900),
        "m",
        0.8,
        500,
        "foo-app",
      );

      const after = searchMemories(emb, 10, 0, {
        types: ["project"],
        embeddingModel: "m",
        indexCacheEnabled: true,
      });
      assert.equal(after.length, 1);
      assert.equal(after[0].content, "Project: Foo — Stack: Express + Vite");
      assert.equal(after[0].projectKey, "foo-app");
    } finally {
      cleanup(dir);
    }
  });

  test("fact dedup (cosine path) is unaffected by the project fast-path", () => {
    const dir = freshMemory();
    try {
      addMemory({
        type: "fact",
        content: "User is James",
        source: null,
        embedding: vec(5),
        embeddingModel: "m",
        confidence: 0.9,
      });
      // Dissimilar fact → added as new (cosine path, no project shortcut).
      _deduplicateAndAdd("fact", "User likes TypeScript", null, vec(50), "m", 0.9, 500, null);
      const facts = getMemories().filter((m) => m.type === "fact");
      assert.equal(facts.length, 2, "distinct facts both retained");
    } finally {
      cleanup(dir);
    }
  });
});
