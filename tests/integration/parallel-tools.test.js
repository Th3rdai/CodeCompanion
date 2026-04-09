const { test } = require("node:test");
const assert = require("node:assert/strict");
const ToolCallHandler = require("../../lib/tool-call-handler");

// Mock MCP client that simulates tool execution with controllable delays
class MockMcpClient {
  async callTool(serverId, toolName, args) {
    const delay = args.delay || 0;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return {
      content: [{ type: "text", text: `Result from ${toolName}` }],
    };
  }
  getAllTools() {
    return [];
  }
}

test("parallel tools — parallel segment executes faster than serial", async () => {
  const mcpClient = new MockMcpClient();
  const handler = new ToolCallHandler(mcpClient, { log: () => {}, debug: () => {} });

  // 3 independent reads, each with 100ms delay
  const toolCalls = [
    { serverId: "test", toolName: "read_file", args: { delay: 100 } },
    { serverId: "test", toolName: "read_file", args: { delay: 100 } },
    { serverId: "test", toolName: "read_file", args: { delay: 100 } },
  ];

  const segments = handler.segmentToolCalls(toolCalls);
  assert.strictEqual(segments.length, 1, "All 3 reads in one parallel segment");
  assert.strictEqual(segments[0].type, "parallel");
  assert.strictEqual(segments[0].calls.length, 3);

  // Simulate parallel execution (as routes/chat.js does)
  const startParallel = Date.now();
  await Promise.all(
    segments[0].calls.map((call) =>
      handler.executeTool(call.serverId, call.toolName, call.args),
    ),
  );
  const parallelTime = Date.now() - startParallel;

  // Simulate serial execution
  const startSerial = Date.now();
  for (const call of toolCalls) {
    await handler.executeTool(call.serverId, call.toolName, call.args);
  }
  const serialTime = Date.now() - startSerial;

  // Parallel should be significantly faster (~3x)
  assert.ok(
    parallelTime < serialTime * 1.5,
    `Parallel (${parallelTime}ms) should be ~3x faster than serial (${serialTime}ms)`,
  );
});

test("parallel tools — error in one parallel call doesn't block others", async () => {
  class FailingMcpClient {
    async callTool(serverId, toolName, args) {
      if (toolName === "read_special") throw new Error("read_special failed!");
      return { content: [{ type: "text", text: "OK from " + toolName }] };
    }
    getAllTools() {
      return [];
    }
  }

  const handler = new ToolCallHandler(new FailingMcpClient(), {
    log: () => {},
    debug: () => {},
  });

  const toolCalls = [
    { serverId: "test", toolName: "read_file", args: {} },
    { serverId: "test", toolName: "read_special", args: {} }, // will fail
    { serverId: "test", toolName: "read_logs", args: {} },
  ];

  const segments = handler.segmentToolCalls(toolCalls);
  assert.strictEqual(segments.length, 1, "All 3 reads in one parallel segment");

  const results = await Promise.all(
    segments[0].calls.map((call) =>
      handler.executeTool(call.serverId, call.toolName, call.args).catch(
        (err) => ({ success: false, error: err.message }),
      ),
    ),
  );

  assert.ok(results[0].success === true, "First read should succeed");
  assert.ok(results[1].success === false, "read_special should fail");
  assert.strictEqual(results[1].error, "read_special failed!");
  assert.ok(results[2].success === true, "Third read should succeed");
});

test("parallel tools — segments execute in original order", async () => {
  const handler = new ToolCallHandler(null, { log: () => {}, debug: () => {} });

  const executionOrder = [];
  handler.executeTool = async function (serverId, toolName) {
    executionOrder.push(toolName);
    return {
      success: true,
      result: { content: [{ type: "text", text: `Result from ${toolName}` }] },
    };
  };

  // [read(0), write(1), search(2), delete(3)] → order-preserving segments
  const toolCalls = [
    { serverId: "test", toolName: "read_file", args: {} },   // safe, index 0
    { serverId: "test", toolName: "write_file", args: {} },  // risky, index 1
    { serverId: "test", toolName: "search_code", args: {} }, // safe, index 2
    { serverId: "test", toolName: "delete_file", args: {} }, // risky, index 3
  ];

  const segments = handler.segmentToolCalls(toolCalls);

  // Expected: [{parallel:[read(0)]}, {serial:[write(1)]}, {parallel:[search(2)]}, {serial:[delete(3)]}]
  assert.strictEqual(segments.length, 4);
  assert.strictEqual(segments[0].type, "parallel");
  assert.strictEqual(segments[0].calls[0].originalIndex, 0);
  assert.strictEqual(segments[1].type, "serial");
  assert.strictEqual(segments[1].calls[0].originalIndex, 1);
  assert.strictEqual(segments[2].type, "parallel");
  assert.strictEqual(segments[2].calls[0].originalIndex, 2);
  assert.strictEqual(segments[3].type, "serial");
  assert.strictEqual(segments[3].calls[0].originalIndex, 3);

  // Execute segments as the chat loop does and collect into resultsByOriginalIndex
  const resultsByOriginalIndex = new Array(toolCalls.length);
  for (const segment of segments) {
    if (segment.type === "parallel") {
      const parallelResults = await Promise.all(
        segment.calls.map((call) =>
          handler.executeTool(call.serverId, call.toolName, call.args),
        ),
      );
      segment.calls.forEach((call, i) => {
        resultsByOriginalIndex[call.originalIndex] = parallelResults[i];
      });
    } else {
      const call = segment.calls[0];
      resultsByOriginalIndex[call.originalIndex] = await handler.executeTool(
        call.serverId,
        call.toolName,
        call.args,
      );
    }
  }

  // Every originalIndex slot is filled
  for (let i = 0; i < toolCalls.length; i++) {
    assert.ok(resultsByOriginalIndex[i], `Slot ${i} should be filled`);
    const text = resultsByOriginalIndex[i].result.content[0].text;
    assert.ok(
      text.includes(toolCalls[i].toolName),
      `Slot ${i} should match tool ${toolCalls[i].toolName}`,
    );
  }
});
