const { test } = require("node:test");
const assert = require("node:assert/strict");
const ToolCallHandler = require("../../lib/tool-call-handler");

// Minimal test logger
const mockLogger = { log: () => {}, debug: () => {} };

test("tool segmentation — reads produce a single parallel segment", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "read_file", args: { path: "/a.txt" } },
    { serverId: "fs", toolName: "list_files", args: { path: "/b" } },
  ];

  const segments = handler.segmentToolCalls(toolCalls);

  assert.strictEqual(segments.length, 1, "One segment for contiguous reads");
  assert.strictEqual(segments[0].type, "parallel");
  assert.strictEqual(segments[0].calls.length, 2);
  assert.strictEqual(segments[0].calls[0].originalIndex, 0);
  assert.strictEqual(segments[0].calls[1].originalIndex, 1);
});

test("tool segmentation — writes each get their own serial segment", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "write_file", args: { path: "/a.txt" } },
    { serverId: "fs", toolName: "create_dir", args: { path: "/b" } },
  ];

  const segments = handler.segmentToolCalls(toolCalls);

  assert.strictEqual(segments.length, 2, "Two serial segments (one per write)");
  assert.strictEqual(segments[0].type, "serial");
  assert.strictEqual(segments[0].calls[0].originalIndex, 0);
  assert.strictEqual(segments[1].type, "serial");
  assert.strictEqual(segments[1].calls[0].originalIndex, 1);
});

test("tool segmentation — mixed safe and risky preserves original order", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "read_file", args: {} },     // safe, index 0
    { serverId: "fs", toolName: "write_file", args: {} },    // risky, index 1
    { serverId: "fs", toolName: "search_code", args: {} },   // safe, index 2
    { serverId: "fs", toolName: "delete_file", args: {} },   // risky, index 3
    { serverId: "fs", toolName: "validate_schema", args: {} }, // safe, index 4
  ];

  const segments = handler.segmentToolCalls(toolCalls);

  // read(0) | write(1) | search(2) | delete(3) | validate(4)
  // → [{parallel:[read]}, {serial:[write]}, {parallel:[search]}, {serial:[delete]}, {parallel:[validate]}]
  assert.strictEqual(segments.length, 5);
  assert.strictEqual(segments[0].type, "parallel");
  assert.strictEqual(segments[0].calls[0].originalIndex, 0);
  assert.strictEqual(segments[1].type, "serial");
  assert.strictEqual(segments[1].calls[0].originalIndex, 1);
  assert.strictEqual(segments[2].type, "parallel");
  assert.strictEqual(segments[2].calls[0].originalIndex, 2);
  assert.strictEqual(segments[3].type, "serial");
  assert.strictEqual(segments[3].calls[0].originalIndex, 3);
  assert.strictEqual(segments[4].type, "parallel");
  assert.strictEqual(segments[4].calls[0].originalIndex, 4);
});

test("tool segmentation — contiguous safe calls merge into one parallel segment", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "read_file", args: {} },
    { serverId: "fs", toolName: "search_code", args: {} },
    { serverId: "fs", toolName: "validate_schema", args: {} },
    { serverId: "fs", toolName: "write_file", args: {} },
  ];

  const segments = handler.segmentToolCalls(toolCalls);

  // [read, search, validate] → one parallel segment; [write] → serial
  assert.strictEqual(segments.length, 2);
  assert.strictEqual(segments[0].type, "parallel");
  assert.strictEqual(segments[0].calls.length, 3, "3 safe calls merged");
  assert.strictEqual(segments[1].type, "serial");
  assert.strictEqual(segments[1].calls[0].toolName, "write_file");
});

test("tool segmentation — builtin tools (explicit risky list)", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "builtin", toolName: "run_terminal_cmd", args: {} },     // risky, index 0
    { serverId: "builtin", toolName: "generate_office_file", args: {} }, // risky, index 1
    { serverId: "builtin", toolName: "validate_scan_project", args: {} }, // safe, index 2
    { serverId: "builtin", toolName: "score_plan", args: {} },           // safe, index 3
  ];

  const segments = handler.segmentToolCalls(toolCalls);

  // [{serial:[run_terminal_cmd]}, {serial:[generate_office_file]}, {parallel:[validate_scan_project, score_plan]}]
  assert.strictEqual(segments.length, 3);
  assert.strictEqual(segments[0].type, "serial");
  assert.strictEqual(segments[0].calls[0].originalIndex, 0);
  assert.strictEqual(segments[1].type, "serial");
  assert.strictEqual(segments[1].calls[0].originalIndex, 1);
  assert.strictEqual(segments[2].type, "parallel");
  assert.strictEqual(segments[2].calls.length, 2, "validate + score merged parallel");
  assert.strictEqual(segments[2].calls[0].originalIndex, 2);
  assert.strictEqual(segments[2].calls[1].originalIndex, 3);
});

test("tool segmentation — unknown patterns are serial (conservative)", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "unknown", toolName: "do_something_weird", args: {} },
    { serverId: "unknown", toolName: "another_unknown", args: {} },
  ];

  const segments = handler.segmentToolCalls(toolCalls);

  assert.strictEqual(segments.length, 2, "Two serial segments (one per unknown)");
  assert.strictEqual(segments[0].type, "serial");
  assert.strictEqual(segments[1].type, "serial");
});

test("tool segmentation — duplicate calls with identical args get distinct originalIndex", () => {
  const handler = new ToolCallHandler(null, mockLogger);
  const toolCalls = [
    { serverId: "fs", toolName: "read_file", args: { path: "/same.txt" } },
    { serverId: "fs", toolName: "read_file", args: { path: "/same.txt" } },
  ];

  const segments = handler.segmentToolCalls(toolCalls);

  assert.strictEqual(segments.length, 1, "Both reads in one parallel segment");
  assert.strictEqual(segments[0].type, "parallel");
  assert.strictEqual(segments[0].calls.length, 2);
  assert.strictEqual(segments[0].calls[0].originalIndex, 0);
  assert.strictEqual(segments[0].calls[1].originalIndex, 1, "No index collision");
});
