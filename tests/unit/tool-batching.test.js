const { test } = require("node:test");
const assert = require("node:assert/strict");
const ToolCallHandler = require("../../lib/tool-call-handler");

// Minimal test logger
const mockLogger = { log: () => {}, debug: () => {} };

test("tool batching — reads go to parallel batch", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "read_file", args: { path: "/a.txt" } },
    { serverId: "fs", toolName: "list_files", args: { path: "/b" } },
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  assert.strictEqual(parallelBatch.length, 2, "Both reads should be parallel");
  assert.strictEqual(serialQueue.length, 0, "No writes, no serial");
  assert.strictEqual(
    parallelBatch[0].originalIndex,
    0,
    "First call has index 0"
  );
  assert.strictEqual(
    parallelBatch[1].originalIndex,
    1,
    "Second call has index 1"
  );
});

test("tool batching — writes go to serial queue", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "write_file", args: { path: "/a.txt" } },
    { serverId: "fs", toolName: "create_dir", args: { path: "/b" } },
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  assert.strictEqual(
    parallelBatch.length,
    0,
    "No safe patterns, no parallel"
  );
  assert.strictEqual(serialQueue.length, 2, "Both writes should be serial");
});

test("tool batching — mixed safe and risky patterns", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "read_file", args: {} },
    { serverId: "fs", toolName: "write_file", args: {} },
    { serverId: "fs", toolName: "search_code", args: {} },
    { serverId: "fs", toolName: "delete_file", args: {} },
    { serverId: "fs", toolName: "validate_schema", args: {} },
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  assert.strictEqual(
    parallelBatch.length,
    3,
    "read, search, validate go parallel"
  );
  assert.strictEqual(
    serialQueue.length,
    2,
    "write, delete go serial"
  );
  // Verify original indices are preserved
  assert.deepStrictEqual(
    parallelBatch.map((c) => c.originalIndex),
    [0, 2, 4],
    "Parallel batch preserves original indices"
  );
  assert.deepStrictEqual(
    serialQueue.map((c) => c.originalIndex),
    [1, 3],
    "Serial queue preserves original indices"
  );
});

test("tool batching — builtin tools (explicit safelist)", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "builtin", toolName: "run_terminal_cmd", args: {} },
    { serverId: "builtin", toolName: "generate_office_file", args: {} },
    { serverId: "builtin", toolName: "validate_scan_project", args: {} },
    { serverId: "builtin", toolName: "score_plan", args: {} },
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  assert.strictEqual(
    parallelBatch.length,
    2,
    "validate_scan_project and score_plan go parallel"
  );
  assert.strictEqual(
    serialQueue.length,
    2,
    "run_terminal_cmd and generate_office_file go serial"
  );
});

test("tool batching — unknown patterns (conservative: serial)", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "unknown", toolName: "do_something_weird", args: {} },
    { serverId: "unknown", toolName: "another_unknown", args: {} },
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  assert.strictEqual(
    parallelBatch.length,
    0,
    "Unknown patterns are conservative default (serial)"
  );
  assert.strictEqual(serialQueue.length, 2, "Both go to serial");
});

test("tool batching — duplicate calls with identical args", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "read_file", args: { path: "/same.txt" } },
    { serverId: "fs", toolName: "read_file", args: { path: "/same.txt" } },
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  assert.strictEqual(
    parallelBatch.length,
    2,
    "Both reads go parallel (no collision)"
  );
  assert.strictEqual(
    parallelBatch[0].originalIndex,
    0,
    "First read has index 0"
  );
  assert.strictEqual(
    parallelBatch[1].originalIndex,
    1,
    "Second read has index 1 (not collision)"
  );
});
