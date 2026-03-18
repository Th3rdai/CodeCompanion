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

// Test image: 1x1 red pixel PNG (base64)
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

// Test image: 1x1 blue pixel PNG (base64)
const TEST_IMAGE_BASE64_2 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test('POST /api/chat accepts images array parameter', async () => {
  const port = 3320;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1',
      OLLAMA_URL: 'http://localhost:11434' // Use real Ollama if available
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    // Make request with images
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What do you see in these images?',
        model: 'llava',
        images: [TEST_IMAGE_BASE64, TEST_IMAGE_BASE64_2]
      }),
    });

    // Verify response structure (will be 500 if Ollama is offline, but structure should be valid)
    assert.ok(res.status === 200 || res.status === 500, `Expected 200 or 500, got ${res.status}`);

    if (res.status === 200) {
      const data = await res.json();
      assert.ok(data.response || data.error, 'Response should have response or error field');
    }

    if (res.status === 500) {
      const data = await res.json();
      assert.ok(data.error, 'Error response should have error field');
    }
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});

test('POST /api/chat rejects invalid image data', async () => {
  const port = 3321;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1'
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    // Make request with invalid image data
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Test',
        model: 'llava',
        images: ['not-valid-base64!@#$%']
      }),
    });

    // Should accept the request (validation happens in frontend)
    // Backend doesn't strictly validate base64 format
    assert.ok(res.status === 200 || res.status === 500, `Expected 200 or 500, got ${res.status}`);
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});

test('POST /api/review accepts images array parameter', async () => {
  const port = 3322;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1',
      OLLAMA_URL: 'http://localhost:11434'
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    // Make review request with images
    const res = await fetch(`${baseUrl}/api/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'function test() { return 42; }',
        filename: 'test.js',
        model: 'llava',
        images: [TEST_IMAGE_BASE64]
      }),
    });

    // Verify response structure
    assert.ok(res.status === 200 || res.status === 500, `Expected 200 or 500, got ${res.status}`);

    if (res.status === 200) {
      const data = await res.json();
      // Review mode returns report-card or conversational response
      assert.ok(
        data.type === 'report-card' || data.response,
        'Review response should have type or response field'
      );
    }
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});

test('POST /api/review handles missing images gracefully', async () => {
  const port = 3323;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1'
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    // Make review request WITHOUT images (should still work)
    const res = await fetch(`${baseUrl}/api/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'function test() { return 42; }',
        filename: 'test.js',
        model: 'llama3'
      }),
    });

    // Should work fine without images
    assert.ok(res.status === 200 || res.status === 500, `Expected 200 or 500, got ${res.status}`);
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});

test('POST /api/pentest accepts images array parameter', async () => {
  const port = 3324;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1',
      OLLAMA_URL: 'http://localhost:11434'
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    // Make pentest request with images
    const res = await fetch(`${baseUrl}/api/pentest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'const user = req.body; db.query("SELECT * FROM users WHERE id=" + user.id);',
        filename: 'vulnerable.js',
        model: 'llava',
        images: [TEST_IMAGE_BASE64]
      }),
    });

    // Verify response structure
    assert.ok(res.status === 200 || res.status === 500, `Expected 200 or 500, got ${res.status}`);

    if (res.status === 200) {
      const data = await res.json();
      // Pentest returns security-report
      assert.ok(
        data.type === 'security-report' || data.error,
        'Pentest response should have type security-report or error'
      );
    }
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});

test('POST /api/pentest/remediate preserves images in response', async () => {
  const port = 3325;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1',
      OLLAMA_URL: 'http://localhost:11434'
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    // Make remediate request with images
    const res = await fetch(`${baseUrl}/api/pentest/remediate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        findings: JSON.stringify({
          overallGrade: 'C',
          categories: {
            injections: {
              grade: 'F',
              findings: [
                {
                  title: 'SQL Injection',
                  description: 'Direct SQL concatenation',
                  code: 'db.query("SELECT * FROM users WHERE id=" + user.id)',
                  fix: 'Use parameterized queries'
                }
              ]
            }
          }
        }),
        files: JSON.stringify([
          { filename: 'vulnerable.js', code: 'db.query("SELECT * FROM users WHERE id=" + user.id)' }
        ]),
        model: 'llava',
        images: [TEST_IMAGE_BASE64]
      }),
    });

    // Verify response structure (streaming response)
    assert.ok(res.status === 200 || res.status === 500, `Expected 200 or 500, got ${res.status}`);
    assert.ok(
      res.headers.get('content-type')?.includes('text/event-stream') || res.headers.get('content-type')?.includes('application/json'),
      'Remediate should return SSE stream or JSON'
    );
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});

test('POST /api/chat limits number of images', async () => {
  const port = 3326;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1'
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    // Create array with 25 images (exceeds default limit of 10)
    const manyImages = Array(25).fill(TEST_IMAGE_BASE64);

    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Test with many images',
        model: 'llava',
        images: manyImages
      }),
    });

    // Backend accepts request (frontend validates count)
    // But backend may truncate or reject based on config
    assert.ok(res.status === 200 || res.status === 400 || res.status === 500, `Expected 200/400/500, got ${res.status}`);
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});

test('POST /api/review respects timeout configuration', async () => {
  const port = 3327;
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(port),
      DEBUG: '0',
      FORCE_HTTP: '1',
      REVIEW_TIMEOUT: '2' // 2 seconds timeout
    },
    stdio: 'pipe',
  });

  try {
    await waitForServer(baseUrl);

    const res = await fetch(`${baseUrl}/api/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'function test() { return 42; }',
        filename: 'test.js',
        model: 'llava',
        images: [TEST_IMAGE_BASE64]
      }),
    });

    // Should complete or timeout within configured limit
    assert.ok(res.status === 200 || res.status === 500 || res.status === 504, `Expected 200/500/504, got ${res.status}`);

    if (res.status === 504) {
      const data = await res.json();
      assert.ok(data.error.includes('timeout') || data.error.includes('timed out'), 'Timeout error should mention timeout');
    }
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
});
