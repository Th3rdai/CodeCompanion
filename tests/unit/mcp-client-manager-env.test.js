const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildStdioMcpEnv } = require("../../lib/mcp-client-manager");

test("buildStdioMcpEnv: prefixed MCP_github_*__ overrides global for same key", () => {
  const prev = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const prevPref =
    process.env.MCP_github_3rdaai_admin__GITHUB_PERSONAL_ACCESS_TOKEN;
  const prevDataDir = process.env.CC_DATA_DIR;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-env-"));
  try {
    process.env.CC_DATA_DIR = tmpDir;
    process.env.GITHUB_PERSONAL_ACCESS_TOKEN = "global-pat";
    process.env.MCP_github_3rdaai_admin__GITHUB_PERSONAL_ACCESS_TOKEN =
      "per-server-pat";
    const env = buildStdioMcpEnv("github-3rdaai-admin", {});
    assert.equal(env.GITHUB_PERSONAL_ACCESS_TOKEN, "per-server-pat");
  } finally {
    if (prev === undefined) delete process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
    else process.env.GITHUB_PERSONAL_ACCESS_TOKEN = prev;
    if (prevPref === undefined)
      delete process.env.MCP_github_3rdaai_admin__GITHUB_PERSONAL_ACCESS_TOKEN;
    else
      process.env.MCP_github_3rdaai_admin__GITHUB_PERSONAL_ACCESS_TOKEN =
        prevPref;
    if (prevDataDir === undefined) delete process.env.CC_DATA_DIR;
    else process.env.CC_DATA_DIR = prevDataDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("buildStdioMcpEnv: client env timeout preserved; global fills GEMINI when not in client", () => {
  const prevG = process.env.GEMINI_API_KEY;
  const prevDataDir = process.env.CC_DATA_DIR;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-env-"));
  try {
    process.env.CC_DATA_DIR = tmpDir;
    process.env.GEMINI_API_KEY = "from-env";
    const env = buildStdioMcpEnv("nano-banana", { timeout: "30000" });
    assert.equal(env.timeout, "30000");
    assert.equal(env.GEMINI_API_KEY, "from-env");
  } finally {
    if (prevG === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevG;
    if (prevDataDir === undefined) delete process.env.CC_DATA_DIR;
    else process.env.CC_DATA_DIR = prevDataDir;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("buildStdioMcpEnv: .env values override stale process env keys", () => {
  const prevDataDir = process.env.CC_DATA_DIR;
  const prevGemini = process.env.GEMINI_API_KEY;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-mcp-env-"));
  try {
    fs.writeFileSync(path.join(tmpDir, ".env"), "GEMINI_API_KEY=from-dotenv\n");
    process.env.CC_DATA_DIR = tmpDir;
    process.env.GEMINI_API_KEY = "stale-env";
    const env = buildStdioMcpEnv("nano-banana", {});
    assert.equal(env.GEMINI_API_KEY, "from-dotenv");
  } finally {
    if (prevDataDir === undefined) delete process.env.CC_DATA_DIR;
    else process.env.CC_DATA_DIR = prevDataDir;
    if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevGemini;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
