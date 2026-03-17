const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/config`);
      if (res.ok) return;
    } catch {}
    await sleep(200);
  }
  throw new Error('Server did not become ready in time');
}

test('rate limiting blocks burst traffic on create-project endpoint', async () => {
  const port = 3319;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1',
      RATE_LIMIT_WINDOW_MS: '60000',
      RATE_LIMIT_MAX_CREATE: '2',
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    const req = () =>
      fetch(`${baseUrl}/api/create-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'rate-limit-check' }),
      });

    const first = await req();
    assert.equal(first.status, 400);
    const second = await req();
    assert.equal(second.status, 400);

    const third = await req();
    assert.equal(third.status, 429);
    const body = await third.json();
    assert.equal(body.code, 'RATE_LIMITED');
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});
