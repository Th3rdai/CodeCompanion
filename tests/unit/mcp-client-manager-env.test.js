const { test } = require("node:test");
const assert = require("node:assert");
const { buildStdioMcpEnv } = require("../../lib/mcp-client-manager");

test("buildStdioMcpEnv: prefixed MCP_github_*__ overrides global for same key", () => {
  const prev = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const prevPref =
    process.env.MCP_github_3rdaai_admin__GITHUB_PERSONAL_ACCESS_TOKEN;
  try {
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
  }
});

test("buildStdioMcpEnv: client env timeout preserved; global fills GEMINI when not in client", () => {
  const prevG = process.env.GEMINI_API_KEY;
  try {
    process.env.GEMINI_API_KEY = "from-env";
    const env = buildStdioMcpEnv("nano-banana", { timeout: "30000" });
    assert.equal(env.timeout, "30000");
    assert.equal(env.GEMINI_API_KEY, "from-env");
  } finally {
    if (prevG === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = prevG;
  }
});
