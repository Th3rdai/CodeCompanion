const { test } = require('node:test');
const assert = require('node:assert');
const ToolCallHandler = require('../../lib/tool-call-handler.js');

test('parseToolCalls XML fallback parses reliably on repeated invocations', () => {
  const h = new ToolCallHandler({});
  const xml = '<notes.read_file>{"path":"/tmp/x"}</notes.read_file>';
  for (let i = 0; i < 3; i++) {
    const calls = h.parseToolCalls(xml);
    assert.strictEqual(calls.length, 1, `invocation ${i}`);
    assert.strictEqual(calls[0].serverId, 'notes');
    assert.strictEqual(calls[0].toolName, 'read_file');
    assert.deepStrictEqual(calls[0].args, { path: '/tmp/x' });
  }
});

test('parseToolCalls primary TOOL_CALL format on repeated invocations', () => {
  const h = new ToolCallHandler({});
  const text = 'TOOL_CALL: grep.run({"pattern":"foo"})';
  for (let i = 0; i < 3; i++) {
    const calls = h.parseToolCalls(text);
    assert.strictEqual(calls.length, 1, `invocation ${i}`);
    assert.strictEqual(calls[0].serverId, 'grep');
    assert.strictEqual(calls[0].toolName, 'run');
    assert.deepStrictEqual(calls[0].args, { pattern: 'foo' });
  }
});
