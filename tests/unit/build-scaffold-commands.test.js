/**
 * Verifies the Build scaffolder copies namespaced command files (subdirectories)
 * into a scaffolded project, so `/harness:*` slash commands resolve in Claude
 * Code (e.g. .claude/commands/harness/plan.md → `/harness:plan`).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// Initialize config to a throwaway data dir so getAppRoot()/registry writes
// (inside scaffoldBuildProject) don't touch the real app data dir.
const { initConfig } = require("../../lib/config");
initConfig(fs.mkdtempSync(path.join(os.tmpdir(), "cc-cfg-")));

const { scaffoldBuildProject } = require("../../lib/build-scaffolder");

const HARNESS_CMDS = ["new-project", "research", "plan", "build", "review"];
const IDE_TARGETS = [
  path.join(".claude", "commands"),
  path.join(".cursor", "commands"),
  path.join(".cursor", "prompts"),
  path.join(".github", "prompts"),
  path.join(".opencode", "commands"),
];

test("scaffold copies /harness:* command files into each IDE commands dir", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-build-cmds-"));
  try {
    const result = scaffoldBuildProject(
      {
        name: "Cmd Test",
        description: "harness command copy",
        outputRoot: root,
      },
      { createModeAllowedRoots: [root] },
    );
    assert.ok(
      result.success,
      `scaffold failed: ${JSON.stringify(result.errors)}`,
    );

    for (const target of IDE_TARGETS) {
      const harnessDir = path.join(result.projectPath, target, "harness");
      assert.ok(
        fs.existsSync(harnessDir),
        `missing harness command dir under ${target}`,
      );
      for (const cmd of HARNESS_CMDS) {
        const f = path.join(harnessDir, `${cmd}.md`);
        assert.ok(
          fs.existsSync(f),
          `missing command file ${target}/harness/${cmd}.md`,
        );
      }
    }

    // The Claude Code copy must be tracked in the returned files list.
    const claudePlan = path.join(".claude", "commands", "harness", "plan.md");
    assert.ok(
      result.files.some((f) => f === claudePlan),
      "scaffold result.files should include the nested harness/plan.md path",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("harness command files use canonical names and $ARGUMENTS where expected", () => {
  const ideRoot = path.join(__dirname, "..", "..", "IDE_COMMANDS", "harness");
  for (const cmd of HARNESS_CMDS) {
    const body = fs.readFileSync(path.join(ideRoot, `${cmd}.md`), "utf-8");
    assert.match(body, /^---/, `${cmd}.md should have front matter`);
  }
  // Phase commands take a numeric arg.
  for (const cmd of ["research", "plan", "build", "review"]) {
    const body = fs.readFileSync(path.join(ideRoot, `${cmd}.md`), "utf-8");
    assert.match(body, /\$ARGUMENTS/, `${cmd}.md should reference $ARGUMENTS`);
  }
});
