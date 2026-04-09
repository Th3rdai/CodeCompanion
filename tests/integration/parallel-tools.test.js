const { test } = require("node:test");
const assert = require("node:assert/strict");
const ToolCallHandler = require("../../lib/tool-call-handler");

// Mock MCP client that simulates tool execution with controllable delays
class MockMcpClient {
  constructor() {
    this.toolCount = 0;
  }

  async callTool(serverId, toolName, args) {
    const delay = args.delay || 0;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return {
      content: [
        {
          type: "text",
          text: `Result from ${toolName}`,
        },
      ],
    };
  }

  getAllTools() {
    return [];
  }
}

test("parallel tools — parallel batch executes faster than serial", async () => {
  const mcpClient = new MockMcpClient();
  const handler = new ToolCallHandler(mcpClient, { log: () => {}, debug: () => {} });

  // 3 independent reads, each with 100ms delay
  const toolCalls = [
    { serverId: "test", toolName: "read_file", args: { delay: 100 } },
    { serverId: "test", toolName: "read_file", args: { delay: 100 } },
    { serverId: "test", toolName: "read_file", args: { delay: 100 } },
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  assert.strictEqual(
    parallelBatch.length,
    3,
    "All 3 reads should be in parallel batch"
  );
  assert.strictEqual(serialQueue.length, 0, "No serial queue");

  // Simulate parallel execution
  const startParallel = Date.now();
  await Promise.all(
    parallelBatch.map((call) =>
      handler.executeTool(call.serverId, call.toolName, call.args)
    )
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
    `Parallel (${parallelTime}ms) should be ~3x faster than serial (${serialTime}ms)`
  );
});

test("parallel tools — error in one tool doesn't block others", async () => {
  // Create a custom mock MCP that throws for read_special tool
  class FailingMcpClient {
    async callTool(serverId, toolName, args) {
      if (toolName === "read_special") {
        throw new Error("read_special failed!");
      }
      return {
        content: [{ type: "text", text: "OK from " + toolName }],
      };
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
    { serverId: "test", toolName: "read_special", args: {} }, // This will fail
    { serverId: "test", toolName: "read_logs", args: {} },
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  // All three read_ tools should go to parallel
  assert.strictEqual(parallelBatch.length, 3, "All 3 reads go to parallel");

  // Execute in parallel with error handling
  const results = await Promise.all(
    parallelBatch.map((call) =>
      handler.executeTool(call.serverId, call.toolName, call.args).catch(
        (err) => ({
          success: false,
          error: err.message,
        })
      )
    )
  );

  // Check results
  assert.ok(results[0].success === true, "First read should succeed");
  assert.ok(results[1].success === false, "Second read should fail");
  assert.strictEqual(results[1].error, "read_special failed!");
  assert.ok(results[2].success === true, "Third read should succeed");
});

test("parallel tools — result order preserved with mixed parallel and serial", async () => {
  const handler = new ToolCallHandler(null, { log: () => {}, debug: () => {} });

  // Mock to tag results with execution order
  let executionOrder = 0;
  handler.executeTool = async function (serverId, toolName, args) {
    const order = executionOrder++;
    return {
      success: true,
      result: {
        content: [
          {
            type: "text",
            text: `Tool ${toolName} executed at order ${order}`,
          },
        ],
      },
    };
  };

  const toolCalls = [
    { serverId: "test", toolName: "read_file", args: {} }, // parallel, index 0
    { serverId: "test", toolName: "write_file", args: {} }, // serial, index 1
    { serverId: "test", toolName: "search_code", args: {} }, // parallel, index 2
    { serverId: "test", toolName: "generate_office_file", args: {} }, // serial (builtin), index 3
  ];

  const { parallelBatch, serialQueue } = handler.batchToolCalls(toolCalls);

  assert.strictEqual(parallelBatch.length, 2, "2 safe tools in parallel");
  assert.strictEqual(serialQueue.length, 2, "2 risky tools in serial");

  // Verify originalIndex tracking
  assert.strictEqual(parallelBatch[0].originalIndex, 0);
  assert.strictEqual(parallelBatch[1].originalIndex, 2);
  assert.strictEqual(serialQueue[0].originalIndex, 1);
  assert.strictEqual(serialQueue[1].originalIndex, 3);

  // Execute and collect results by originalIndex
  const resultsByIndex = new Array(toolCalls.length);

  // Parallel
  const parallelResults = await Promise.all(
    parallelBatch.map((call) =>
      handler.executeTool(call.serverId, call.toolName, call.args)
    )
  );
  parallelBatch.forEach((call, idx) => {
    resultsByIndex[call.originalIndex] = parallelResults[idx];
  });

  // Serial
  for (const call of serialQueue) {
    const result = await handler.executeTool(call.serverId, call.toolName, call.args);
    resultsByIndex[call.originalIndex] = result;
  }

  // Verify original order is preserved in results
  for (let i = 0; i < toolCalls.length; i++) {
    assert.ok(
      resultsByIndex[i],
      `Result at original index ${i} should exist`
    );
    const tool = toolCalls[i];
    const text = resultsByIndex[i].result.content[0].text;
    assert.ok(
      text.includes(tool.toolName),
      `Result ${i} should correspond to tool ${tool.toolName}`
    );
  }
});
