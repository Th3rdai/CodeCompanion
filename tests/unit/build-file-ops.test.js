/**
 * Integration tests for GET/PUT /api/build/projects/:id/files/:filename
 * (whitelist, path checks, atomic write). Spawns server.js like tests/rate-limit.test.js.
 */
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(baseUrl, timeoutMs = 20000) {
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

describe(
  'Build File Operations',
  { concurrency: false },
  () => {
    let baseUrl;
    let projectId;
    let child;
    let tmpRoot;
    let planningDir;
    const port = 22000 + (process.pid % 8000);

    before(async () => {
      tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-build-file-ops-'));
      const dataDir = path.join(tmpRoot, 'data');
      fs.mkdirSync(dataDir, { recursive: true });
      const projectDir = path.join(tmpRoot, 'project');
      planningDir = path.join(projectDir, '.planning');
      fs.mkdirSync(planningDir, { recursive: true });
      fs.writeFileSync(path.join(planningDir, 'STATE.md'), 'original-state\n', 'utf8');

      fs.writeFileSync(
        path.join(dataDir, '.cc-config.json'),
        JSON.stringify({
          docling: { enabled: false },
          preferredPort: port,
        }),
        'utf8'
      );

      baseUrl = `http://127.0.0.1:${port}`;
      child = spawn(process.execPath, ['server.js'], {
        cwd: path.resolve(__dirname, '..', '..'),
        env: {
          ...process.env,
          CC_DATA_DIR: dataDir,
          PORT: String(port),
          DEBUG: '0',
          FORCE_HTTP: '1',
        },
        stdio: 'pipe',
      });

      await waitForServer(baseUrl);

      const reg = await fetch(`${baseUrl}/api/build/projects/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'TestProj', projectPath: projectDir }),
      });
      const regText = await reg.text();
      assert.equal(reg.status, 200, regText);
      const regJson = JSON.parse(regText);
      assert.ok(regJson.id);
      projectId = regJson.id;
    });

    after(async () => {
      if (child && !child.killed) {
        child.kill('SIGTERM');
        await sleep(400);
        if (!child.killed) child.kill('SIGKILL');
      }
      if (tmpRoot && fs.existsSync(tmpRoot)) {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      }
    });

    it('allows reading and writing whitelisted planning files', async () => {
      const getRes = await fetch(`${baseUrl}/api/build/projects/${projectId}/files/STATE.md`);
      assert.equal(getRes.status, 200);
      const body = await getRes.json();
      assert.equal(body.filename, 'STATE.md');
      assert.match(body.content, /original-state/);

      const putRes = await fetch(`${baseUrl}/api/build/projects/${projectId}/files/STATE.md`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'updated-by-test\n' }),
      });
      assert.equal(putRes.status, 200, await putRes.text());

      const get2 = await fetch(`${baseUrl}/api/build/projects/${projectId}/files/STATE.md`);
      assert.equal(get2.status, 200);
      const body2 = await get2.json();
      assert.equal(body2.content, 'updated-by-test\n');
    });

    it('rejects non-whitelisted filenames with 403', async () => {
      const res = await fetch(`${baseUrl}/api/build/projects/${projectId}/files/secrets.env`);
      assert.equal(res.status, 403);
      const j = await res.json();
      assert.match(j.error || '', /whitelist/i);
    });

    it('blocks path traversal in filename segment (403)', async () => {
      const evil = encodeURIComponent('../ROADMAP.md');
      const res = await fetch(`${baseUrl}/api/build/projects/${projectId}/files/${evil}`);
      assert.equal(res.status, 403);
    });

    it('writes via temp file then rename (no stale .tmp left)', async () => {
      const target = 'ROADMAP.md';
      fs.writeFileSync(path.join(planningDir, target), '# Roadmap\n', 'utf8');

      const putRes = await fetch(`${baseUrl}/api/build/projects/${projectId}/files/${target}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: '# Roadmap\n\natomic ok\n' }),
      });
      assert.equal(putRes.status, 200, await putRes.text());

      const entries = fs.readdirSync(planningDir);
      const tmpLeft = entries.filter((f) => f.includes('.tmp.'));
      assert.equal(tmpLeft.length, 0, `unexpected tmp files: ${tmpLeft.join(', ')}`);
      const disk = fs.readFileSync(path.join(planningDir, target), 'utf8');
      assert.match(disk, /atomic ok/);
    });
  }
);
