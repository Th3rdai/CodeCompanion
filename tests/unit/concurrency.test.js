/**
 * Concurrency cap tests for the parallel tool-segment worker pool.
 *
 * The pool lives inline in routes/chat.js as a closure (see the parallel
 * segment branch that builds `workers` with Math.min(maxConcurrent, calls.length)).
 * This test replicates the exact algorithm to lock in:
 *   - max concurrency cap is respected (never more than N in flight at once)
 *   - results are returned in original call index order
 *   - one failed call does not block siblings (allSettled-equivalent via .catch)
 *
 * If routes/chat.js changes the pool shape, update this algorithm in lockstep.
 */

const test = require("node:test");
const assert = require("node:assert/strict");

// Exact replica of the worker pool in routes/chat.js §parallel segment branch.
async function runBoundedPool(calls, executor, maxConcurrent) {
  const results = new Array(calls.length);
  let next = 0;
  let inFlight = 0;
  let peak = 0;

  async function runWorker() {
    while (next < calls.length) {
      const i = next++;
      inFlight++;
      if (inFlight > peak) peak = inFlight;
      try {
        results[i] = await executor(calls[i]);
      } catch (err) {
        results[i] = { success: false, error: err.message };
      } finally {
        inFlight--;
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(maxConcurrent, calls.length) },
    runWorker,
  );
  await Promise.all(workers);
  return { results, peak };
}

test("concurrency pool — respects maxConcurrent cap", async () => {
  const calls = Array.from({ length: 10 }, (_, i) => ({ id: i }));
  const cap = 4;

  const executor = async () => {
    // Simulate work; multiple calls must overlap to reach the cap.
    await new Promise((r) => setTimeout(r, 15));
    return { success: true };
  };

  const { peak } = await runBoundedPool(calls, executor, cap);
  assert.ok(
    peak <= cap,
    `peak in-flight (${peak}) must not exceed cap (${cap})`,
  );
  assert.ok(peak >= 2, `expected some overlap, got peak=${peak}`);
});

test("concurrency pool — preserves original index ordering in results", async () => {
  const calls = Array.from({ length: 6 }, (_, i) => ({ id: i }));

  // Finish in reverse order to prove index mapping is by position, not completion.
  const executor = async (call) => {
    await new Promise((r) => setTimeout(r, (6 - call.id) * 5));
    return { success: true, id: call.id };
  };

  const { results } = await runBoundedPool(calls, executor, 3);
  for (let i = 0; i < calls.length; i++) {
    assert.strictEqual(results[i].id, i, `result[${i}] must map to call ${i}`);
  }
});

test("concurrency pool — failed call does not block siblings", async () => {
  const calls = [{ id: 0 }, { id: 1, fail: true }, { id: 2 }, { id: 3 }];

  const executor = async (call) => {
    await new Promise((r) => setTimeout(r, 5));
    if (call.fail) throw new Error("boom");
    return { success: true, id: call.id };
  };

  const { results } = await runBoundedPool(calls, executor, 2);

  assert.strictEqual(results.length, 4);
  assert.strictEqual(results[0].success, true);
  assert.strictEqual(results[1].success, false, "failed call isolated");
  assert.match(results[1].error, /boom/);
  assert.strictEqual(
    results[2].success,
    true,
    "sibling after failure still ran",
  );
  assert.strictEqual(
    results[3].success,
    true,
    "sibling after failure still ran",
  );
});

test("concurrency pool — cap=1 degenerates to serial execution", async () => {
  const calls = Array.from({ length: 5 }, (_, i) => ({ id: i }));

  const executor = async () => {
    await new Promise((r) => setTimeout(r, 5));
    return { success: true };
  };

  const { peak } = await runBoundedPool(calls, executor, 1);
  assert.strictEqual(peak, 1, "cap=1 must never have more than 1 in flight");
});
