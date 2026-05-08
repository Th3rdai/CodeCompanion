# MCP Sandbox & Index Patterns

Patterns for using **external** MCP servers (`mcpClients` in `.cc-config.json`) to keep large or sensitive workloads **out** of the chat context.

These are **patterns**, not bundled servers — Code Companion does not ship third-party MCP servers in any installer. You bring your own.

> **See also:** [CC-CONFIG.md](./CC-CONFIG.md) (config), [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) (env vs config precedence, sensitive routes), [ARCHON-MCP.md](./ARCHON-MCP.md) (a real `mcpClients` HTTP example).

---

## Why use a sandbox or index server

Code Companion's chat context is finite. Two failure modes drive most "fetch failed" / 5-min Ollama timeouts on local hardware:

1. **Tool output dumped into the prompt** — running a script, scanning a folder, or summarizing a 200-page PDF inline can push a single round past `num_ctx`. Phase 3 (cumulative tool-output cap + project-folder externalization) addresses this for builtins, but third-party MCP tools that paste their full output into a `tool` message will still bloat history.
2. **Wide-scope retrieval inside the model** — asking the LLM to "find every place we use `foo` across this repo" forces it to remember everything you ever told it. An indexed search server returns 5 lines instead of 5 MB.

Both patterns externalize the work: **the MCP server does the heavy lifting, the model sees a small artifact**.

---

## Pattern A — Sandbox: execute code, return only artifacts

A stdio MCP server runs untrusted or expensive code in an isolated environment (container, VM, ephemeral process), keeps the **full output on disk**, and returns a **path + summary** to the model.

### When to use

- Running generated code (Python, JS, shell) without touching the host.
- Producing large outputs the user wants on disk anyway (CSV exports, generated images, reports).
- Tasks that historically returned 50–500 KB into chat ("run this script and tell me what happened").

### Wire shape

```jsonc
// .cc-config.json (excerpt)
{
  "mcpClients": [
    {
      "id": "sandbox",
      "name": "Local Sandbox",
      "transport": "stdio",
      "command": "/usr/local/bin/your-sandbox-mcp",
      "args": ["--workdir", "/Users/you/Projects/CodeCompanion/sandbox-out"],
      "env": {},
      "autoConnect": true,
      "disabledTools": [],
    },
  ],
}
```

### Tool contract (pseudocode)

```jsonc
// tool: sandbox.run
// input
{
  "language": "python",
  "code": "import pandas as pd\n…",
  "timeoutSec": 30
}
// output
{
  "ok": true,
  "exitCode": 0,
  "artifactPath": "sandbox-out/run-2026-05-08T18-30-12.txt",
  "summary": "Wrote 1,284 rows to data.csv; stderr was empty.",
  "byteCount": 524288
}
```

The **prompt only sees `summary` + `artifactPath`** — the model can then ask the user to open the file, or call a separate `read_file` tool with a byte range.

### Security checklist

- [ ] Sandbox runs as an unprivileged user (no `sudo`, no host network unless explicitly needed).
- [ ] Working directory is **inside** `config.projectFolder` so Code Companion's path allowlists (`lib/security-helpers.js`, `validateProjectFilePath`) accept reads of the artifact later.
- [ ] CPU + wall-clock + memory caps enforced **inside the server**, not just by Code Companion's `chatTimeoutSec`.
- [ ] Network egress is denied by default — opt-in per call.
- [ ] No persistent state between calls: each invocation gets a fresh tempdir.
- [ ] Server logs to its own file, not the model's prompt.

---

## Pattern B — Indexed search over project files

An HTTP (or SSE / streamable-HTTP) MCP server holds an offline index of the project — symbols, embeddings, full-text — and answers queries with **scored snippets**, not whole files.

### When to use

- "How does X work?" / "Where is Y called?" across a large repo.
- Code review and refactor tasks that would otherwise force the model to re-read 30 files per turn.
- Replacing pasted-folder context with on-demand lookup.

### Wire shape

```jsonc
// .cc-config.json (excerpt) — HTTP transport, no secrets in the URL
{
  "mcpClients": [
    {
      "id": "code-index",
      "name": "Code Index",
      "transport": "http",
      "command": "",
      "args": [],
      "env": {},
      "url": "http://127.0.0.1:9001/mcp",
      "autoConnect": true,
      "disabledTools": [],
    },
  ],
}
```

If the server only speaks SSE, set `"transport": "sse"` and use the SSE URL. Code Companion's HTTP transport auto-falls back to SSE on `text/event-stream` responses (see `lib/mcp-client-manager.js`), so most servers "just work" with `"transport": "http"`.

### Tool contract (pseudocode)

```jsonc
// tool: code_index.search
// input
{
  "query": "where is the chat abort controller wired",
  "scope": ["lib/**", "src/**"],
  "limit": 5
}
// output
{
  "matches": [
    {
      "path": "lib/chat-post-handler.js",
      "line": 1207,
      "score": 0.84,
      "snippet": "sendEvent({ error: formatUserOllamaChatError({ status: parsed.status, …, log }) })"
    },
    /* … */
  ],
  "totalSearched": 412,
  "indexBuiltAt": "2026-05-08T11:00:00Z"
}
```

The model picks one or two paths and uses Code Companion's existing `read_file` tool with a line range — **no full file ever enters the prompt** unless the user explicitly asks.

### Index hygiene

- Trigger reindex on file save **or** behind a debounce — never inline at query time (latency spikes).
- Persist the index outside `projectFolder` (or in a `.gitignore`d sub-path) so it isn't picked up by review/security scans.
- Surface `indexBuiltAt` in every response so the model can warn the user when the index is stale.

---

## License vetting checklist (read before adopting any third-party server)

External MCP servers ship arbitrary code that runs on the user's machine with the same privileges as Code Companion. Before adding one to `.cc-config.json` (or recommending one in docs):

- [ ] **License is a real OSS license** (MIT, Apache-2.0, BSD-2/3, MPL-2.0, ISC). Avoid: "source available", custom EULAs, "free for non-commercial," anything copyleft you can't honor downstream.
- [ ] **License file is in the repo** (not just a README claim). Check the actual `LICENSE` / `COPYING`.
- [ ] **Maintainer is identifiable** — real org or individual, not an anonymous one-commit account.
- [ ] **Recent activity** — last commit < 12 months for a server you depend on; sub-12-week for security-relevant servers.
- [ ] **No ambient credentials** — server should never prompt for or read `~/.aws`, `~/.ssh`, `~/.gnupg`, browser cookies, or shell history. If it does, document the threat surface.
- [ ] **Network policy is documented** — what hosts does it call out to, with what credentials, on what trigger.
- [ ] **stdio servers**: run with `node --inspect` or strace once before trusting it. HTTP servers: bind loopback (`127.0.0.1`) only.

If any item is unclear, **don't bundle, don't auto-connect** — point users to the upstream README and let them opt in via Settings → MCP Clients.

---

## Explicit do-not

- **Do NOT bundle third-party MCP servers in any Code Companion installer**, packaged Electron build, Docker image, or release tag.
  - License risk: copyleft contagion, attribution requirements you can't meet at install time.
  - Security risk: a compromised upstream becomes a compromised release.
  - Update risk: users can't pin or audit the version they got.
- **Do NOT auto-write tokens** for third-party servers into `.cc-config.json`. Use `.env` overrides (`MCP_<id>__…`) so secrets stay out of JSON. See [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md).
- **Do NOT proxy a third-party MCP server through Code Companion's built-in HTTP server.** That re-exposes its tools under your loopback / API-key gate as if you wrote them, which silently inherits the upstream's blast radius.

---

## Related

- [CC-CONFIG.md](./CC-CONFIG.md) — `mcpClients` shape, secret hygiene, where the config file lives.
- [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) — env-vs-config precedence, sensitive route gating.
- [ARCHON-MCP.md](./ARCHON-MCP.md) — concrete HTTP MCP example (no secrets, loopback only).
- [MCP-PARALLEL-EXECUTION-RESEARCH.md](./MCP-PARALLEL-EXECUTION-RESEARCH.md) — performance notes for parallel tool calls.
