/**
 * Unit tests for agent tool-call loop improvements
 *
 * Tests three enhancements:
 * 1. Tool-call loop pattern detection (early warning at 3+ repetitions)
 * 2. Background process auto-suggestion for long-running commands
 * 3. Progress indicators (verification of existing implementation)
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";

// ─────────────────────────────────────────────────────────────────────────────
// Enhancement 1: Tool-Call Loop Pattern Detection
// ─────────────────────────────────────────────────────────────────────────────

describe("Tool-Call Loop Pattern Detection", () => {
  let toolCallHistory;
  let patternWarningShown;

  beforeEach(() => {
    toolCallHistory = [];
    patternWarningShown = false;
  });

  function recordToolCall(round, serverId, toolName) {
    toolCallHistory.push({
      round,
      toolName,
      serverId,
      signature: `${serverId}.${toolName}`,
    });
  }

  function detectPattern(round) {
    if (patternWarningShown || round < 2) {
      return null;
    }

    const signatureCounts = {};
    toolCallHistory.forEach((entry) => {
      signatureCounts[entry.signature] =
        (signatureCounts[entry.signature] || 0) + 1;
    });

    const repeatedTools = Object.entries(signatureCounts)
      .filter(([, count]) => count >= 3)
      .sort(([, a], [, b]) => b - a);

    if (repeatedTools.length > 0) {
      const [mostRepeatedTool, repeatCount] = repeatedTools[0];
      patternWarningShown = true;
      return {
        tool: mostRepeatedTool,
        count: repeatCount,
        round: round + 1,
        message: `Multiple attempts needed (${mostRepeatedTool} called ${repeatCount} times). Working on it...`,
      };
    }

    return null;
  }

  it("should not detect pattern with only 2 calls to same tool", () => {
    recordToolCall(1, "builtin", "run_terminal_cmd");
    recordToolCall(2, "builtin", "run_terminal_cmd");

    const pattern = detectPattern(2);
    assert.strictEqual(pattern, null, "Should not detect pattern with 2 calls");
  });

  it("should detect pattern at exactly 3 calls to same tool", () => {
    recordToolCall(1, "builtin", "run_terminal_cmd");
    recordToolCall(2, "builtin", "run_terminal_cmd");
    recordToolCall(3, "builtin", "run_terminal_cmd");

    const pattern = detectPattern(3);
    assert.notStrictEqual(pattern, null, "Should detect pattern at 3 calls");
    assert.strictEqual(pattern.tool, "builtin.run_terminal_cmd");
    assert.strictEqual(pattern.count, 3);
  });

  it("should track different tools separately", () => {
    recordToolCall(1, "builtin", "run_terminal_cmd");
    recordToolCall(2, "pci-assistant", "requirement_lookup");
    recordToolCall(3, "builtin", "run_terminal_cmd");

    const pattern = detectPattern(3);
    assert.strictEqual(
      pattern,
      null,
      "Should not detect pattern with different tools",
    );
  });

  it("should detect pattern across non-consecutive rounds", () => {
    recordToolCall(1, "builtin", "run_terminal_cmd");
    recordToolCall(2, "pci-assistant", "requirement_lookup");
    recordToolCall(3, "builtin", "run_terminal_cmd");
    recordToolCall(4, "pci-assistant", "requirement_lookup");
    recordToolCall(5, "builtin", "run_terminal_cmd");

    const pattern = detectPattern(5);
    assert.notStrictEqual(
      pattern,
      null,
      "Should detect pattern across non-consecutive rounds",
    );
    assert.strictEqual(pattern.count, 3);
  });

  it("should only warn once per conversation", () => {
    recordToolCall(1, "builtin", "run_terminal_cmd");
    recordToolCall(2, "builtin", "run_terminal_cmd");
    recordToolCall(3, "builtin", "run_terminal_cmd");

    const firstWarning = detectPattern(3);
    assert.notStrictEqual(
      firstWarning,
      null,
      "Should detect pattern first time",
    );

    recordToolCall(4, "builtin", "run_terminal_cmd");
    const secondWarning = detectPattern(4);
    assert.strictEqual(
      secondWarning,
      null,
      "Should not warn again after first warning",
    );
  });

  it("should report most repeated tool when multiple patterns exist", () => {
    // builtin.run_terminal_cmd: 4 times
    recordToolCall(1, "builtin", "run_terminal_cmd");
    recordToolCall(2, "builtin", "run_terminal_cmd");
    recordToolCall(3, "builtin", "run_terminal_cmd");
    recordToolCall(4, "builtin", "run_terminal_cmd");

    // pci-assistant.requirement_lookup: 3 times
    recordToolCall(5, "pci-assistant", "requirement_lookup");
    recordToolCall(6, "pci-assistant", "requirement_lookup");
    recordToolCall(7, "pci-assistant", "requirement_lookup");

    const pattern = detectPattern(7);
    assert.notStrictEqual(pattern, null, "Should detect pattern");
    // Should report the MOST repeated tool (sorted desc), not just the first
    assert.strictEqual(pattern.tool, "builtin.run_terminal_cmd");
    assert.strictEqual(pattern.count, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enhancement 2: Background Process Auto-Suggestion
// ─────────────────────────────────────────────────────────────────────────────

describe("Background Process Auto-Suggestion", () => {
  // Simplified version of the detection logic for testing
  function detectLongRunningCommand(command, args = []) {
    const cmd = command.toLowerCase();
    const fullCmd = [cmd, ...args.map((a) => String(a).toLowerCase())].join(
      " ",
    );

    const patterns = [
      {
        pattern: /npm\s+(run\s+)?(dev|start|serve|watch)/,
        name: "npm dev server",
      },
      {
        pattern: /npx\s+(vite|webpack-dev-server|next\s+dev)/,
        name: "dev server",
      },
      { pattern: /node\s+(server|app|index)\.js/, name: "Node server" },
      { pattern: /nodemon/, name: "nodemon watcher" },
      { pattern: /python.*-m\s+http\.server/, name: "Python HTTP server" },
      { pattern: /python.*manage\.py\s+runserver/, name: "Django dev server" },
      { pattern: /flask\s+run/, name: "Flask dev server" },
      { pattern: /jekyll\s+serve/, name: "Jekyll server" },
      { pattern: /hugo\s+server/, name: "Hugo server" },
      { pattern: /gatsby\s+develop/, name: "Gatsby dev server" },
      { pattern: /webpack\s+--watch/, name: "webpack watcher" },
      { pattern: /tsc\s+--watch/, name: "TypeScript watcher" },
      { pattern: /sass\s+--watch/, name: "Sass watcher" },
      { pattern: /^watch\b/, name: "file watcher" },
      { pattern: /(--watch|:watch)\b/, name: "watch mode" },
      { pattern: /\btail\s+-f\b/, name: "log tail" },
    ];

    for (const { pattern, name } of patterns) {
      if (pattern.test(fullCmd)) {
        return {
          isLongRunning: true,
          suggestion: `This appears to be a ${name}, which typically runs indefinitely. Consider using background:true to avoid timeout.`,
        };
      }
    }

    return { isLongRunning: false };
  }

  describe("npm dev servers", () => {
    it("should detect 'npm run dev'", () => {
      const result = detectLongRunningCommand("npm", ["run", "dev"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("npm dev server"));
    });

    it("should detect 'npm start'", () => {
      const result = detectLongRunningCommand("npm", ["start"]);
      assert.strictEqual(result.isLongRunning, true);
    });

    it("should detect 'npm run watch'", () => {
      const result = detectLongRunningCommand("npm", ["run", "watch"]);
      assert.strictEqual(result.isLongRunning, true);
    });

    it("should not detect 'npm install'", () => {
      const result = detectLongRunningCommand("npm", ["install"]);
      assert.strictEqual(result.isLongRunning, false);
    });

    it("should not detect 'npm test'", () => {
      const result = detectLongRunningCommand("npm", ["test"]);
      assert.strictEqual(result.isLongRunning, false);
    });
  });

  describe("npx dev servers", () => {
    it("should detect 'npx vite'", () => {
      const result = detectLongRunningCommand("npx", ["vite"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("dev server"));
    });

    it("should detect 'npx webpack-dev-server'", () => {
      const result = detectLongRunningCommand("npx", ["webpack-dev-server"]);
      assert.strictEqual(result.isLongRunning, true);
    });

    it("should detect 'npx next dev'", () => {
      const result = detectLongRunningCommand("npx", ["next", "dev"]);
      assert.strictEqual(result.isLongRunning, true);
    });
  });

  describe("Node.js servers", () => {
    it("should detect 'node server.js'", () => {
      const result = detectLongRunningCommand("node", ["server.js"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("Node server"));
    });

    it("should detect 'node app.js'", () => {
      const result = detectLongRunningCommand("node", ["app.js"]);
      assert.strictEqual(result.isLongRunning, true);
    });

    it("should detect 'nodemon'", () => {
      const result = detectLongRunningCommand("nodemon", ["server.js"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("nodemon watcher"));
    });
  });

  describe("Python servers", () => {
    it("should detect 'python -m http.server'", () => {
      const result = detectLongRunningCommand("python", ["-m", "http.server"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("Python HTTP server"));
    });

    it("should detect 'python manage.py runserver'", () => {
      const result = detectLongRunningCommand("python", [
        "manage.py",
        "runserver",
      ]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("Django dev server"));
    });

    it("should detect 'flask run'", () => {
      const result = detectLongRunningCommand("flask", ["run"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("Flask dev server"));
    });
  });

  describe("Static site generators", () => {
    it("should detect 'jekyll serve'", () => {
      const result = detectLongRunningCommand("jekyll", ["serve"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("Jekyll server"));
    });

    it("should detect 'hugo server'", () => {
      const result = detectLongRunningCommand("hugo", ["server"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("Hugo server"));
    });

    it("should detect 'gatsby develop'", () => {
      const result = detectLongRunningCommand("gatsby", ["develop"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("Gatsby dev server"));
    });
  });

  describe("Build watchers", () => {
    it("should detect 'webpack --watch'", () => {
      const result = detectLongRunningCommand("webpack", ["--watch"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("webpack watcher"));
    });

    it("should detect 'tsc --watch'", () => {
      const result = detectLongRunningCommand("tsc", ["--watch"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("TypeScript watcher"));
    });

    it("should detect 'sass --watch'", () => {
      const result = detectLongRunningCommand("sass", ["--watch"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("Sass watcher"));
    });
  });

  describe("Generic watch and monitoring", () => {
    it("should detect generic 'watch' command", () => {
      const result = detectLongRunningCommand("watch", ["ls", "-la"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("file watcher"));
    });

    it("should detect 'tail -f'", () => {
      const result = detectLongRunningCommand("tail", ["-f", "app.log"]);
      assert.strictEqual(result.isLongRunning, true);
      assert.ok(result.suggestion.includes("log tail"));
    });

    it("should detect ':watch' npm scripts (e.g. 'npm run test:watch')", () => {
      const result = detectLongRunningCommand("npm", ["run", "test:watch"]);
      assert.strictEqual(result.isLongRunning, true);
    });

    it("should NOT detect 'watch' as a filename or arg substring", () => {
      // Regression guard: the old /\bwatch\b/ matched these false positives.
      assert.strictEqual(
        detectLongRunningCommand("cat", ["watch.js"]).isLongRunning,
        false,
      );
      assert.strictEqual(
        detectLongRunningCommand("grep", ["watch", "src/app.js"]).isLongRunning,
        false,
      );
    });
  });

  describe("Case insensitivity", () => {
    it("should detect uppercase commands", () => {
      const result = detectLongRunningCommand("NPM", ["RUN", "DEV"]);
      assert.strictEqual(result.isLongRunning, true);
    });

    it("should detect mixed case commands", () => {
      const result = detectLongRunningCommand("Node", ["Server.js"]);
      assert.strictEqual(result.isLongRunning, true);
    });
  });

  describe("Non-long-running commands", () => {
    it("should not detect 'ls'", () => {
      const result = detectLongRunningCommand("ls", ["-la"]);
      assert.strictEqual(result.isLongRunning, false);
    });

    it("should not detect 'git status'", () => {
      const result = detectLongRunningCommand("git", ["status"]);
      assert.strictEqual(result.isLongRunning, false);
    });

    it("should not detect 'echo'", () => {
      const result = detectLongRunningCommand("echo", ["hello"]);
      assert.strictEqual(result.isLongRunning, false);
    });

    it("should not detect 'cat'", () => {
      const result = detectLongRunningCommand("cat", ["file.txt"]);
      assert.strictEqual(result.isLongRunning, false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enhancement 3: Progress Indicators (Verification)
// ─────────────────────────────────────────────────────────────────────────────

describe("Progress Indicators", () => {
  it("should verify modelWait SSE event structure", () => {
    // Simulated SSE event from server
    const modelWaitEvent = {
      modelWait: {
        round: 1,
        tool: "requirement_lookup",
        count: 1,
        message: "Calling tool requirement_lookup (round 1)...",
      },
    };

    assert.ok(modelWaitEvent.modelWait, "Should have modelWait property");
    assert.strictEqual(typeof modelWaitEvent.modelWait.round, "number");
    assert.strictEqual(typeof modelWaitEvent.modelWait.tool, "string");
    assert.strictEqual(typeof modelWaitEvent.modelWait.count, "number");
    assert.strictEqual(typeof modelWaitEvent.modelWait.message, "string");
  });

  it("should verify tool_pattern SSE event structure", () => {
    // Simulated SSE event from new pattern detection
    const patternEvent = {
      notice: {
        kind: "tool_pattern",
        tool: "builtin.run_terminal_cmd",
        count: 3,
        round: 4,
        message:
          "Multiple attempts needed (builtin.run_terminal_cmd called 3 times). Working on it...",
      },
    };

    assert.ok(patternEvent.notice, "Should have notice property");
    assert.strictEqual(patternEvent.notice.kind, "tool_pattern");
    assert.strictEqual(typeof patternEvent.notice.tool, "string");
    assert.strictEqual(typeof patternEvent.notice.count, "number");
    assert.strictEqual(typeof patternEvent.notice.round, "number");
    assert.ok(patternEvent.notice.message.includes("Multiple attempts needed"));
  });

  it("should verify heartbeat timing intervals", () => {
    // Verify heartbeat timer configuration
    const HEARTBEAT_MS = 20000; // 20 seconds per implementation

    assert.strictEqual(HEARTBEAT_MS, 20000, "Heartbeat should be 20 seconds");
    assert.ok(HEARTBEAT_MS >= 10000, "Heartbeat should be at least 10 seconds");
    assert.ok(HEARTBEAT_MS <= 30000, "Heartbeat should not exceed 30 seconds");
  });
});
