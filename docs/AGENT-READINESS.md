# Agent Readiness checklist

Use this list so **Chat** (with built-in agent tools and optional MCP) can reliably go from **idea → working code**: scaffold files, run installs, run tests, and iterate. The same settings apply whether you use the web app or the **Electron** desktop build.

## 1. Ollama and models

- [ ] **Ollama is running** (local `http://localhost:11434` or **Ollama Cloud** with URL + key in Settings → General).
- [ ] **Test** connection in Settings shows models.
- [ ] **Models installed** for the sizes you need (pull models in Ollama).
- [ ] **Auto model map** (optional): per-mode defaults when the toolbar uses **Auto** — see `docs/ENVIRONMENT_VARIABLES.md` and `lib/auto-model.js`.

## 2. Project scope (where the agent may work)

- [ ] **Settings → Project folder** points at the **permission root** (repo or parent you trust). All agent file access stays under this path.
- [ ] **File Browser** is opened to the folder you want as **active context** (often the app subfolder). Agent **`write_file`** resolves **relative** paths from this folder; **double-click a folder** in the tree to make it the root.
- [ ] **Persisted folder**: changing the File Browser updates `chatFolder` in `.cc-config.json` (and a browser localStorage hint per project) so the same root comes back after restart when possible.

## 3. Agent terminal (required for `npm`, `git`, tests, dev servers)

- [ ] **Agent terminal** is **enabled** in Settings → General.
- [ ] **Allowlist** includes every command basename the stack needs, e.g. `npm`, `node`, `npx`, `pnpm`, `yarn`, `python3`, `pip3`, `uv`, `git`, `pytest`, `cargo`, `go`, `make`, `bash` (only if you truly need it — prefer `sh`/`python3` scripts), etc.
- [ ] **Blocklist** stays sensible (defaults help avoid destructive patterns).
- [ ] Understand **no shell**: `run_terminal_cmd` uses `spawn` — no `&&`, `|`, `>`, `$(...)`. Use **`cwd`** for subdirectory runs; use **`write_file`** + run `python3 path/to/script.py` for multi-step scripts.

See **CLIPLAN.md** and **docs/TERMINALFEATURE.md** (integrated Terminal vs agent terminal).

## 4. Optional agent capabilities (builtins)

Turn on only what you need; each adds prompt surface and sometimes latency.

| Toggle / area         | Enables                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| **Agent validate**    | `validate_scan_project`, `validate_generate_command`                       |
| **Agent planner**     | `score_plan`                                                               |
| **Agent Web Browser** | `browse_url`, `browser_*` (public **http/https** only — **not** localhost) |
| **Agent app skills**  | `review_run`, `pentest_scan`, `pentest_scan_folder`, `builder_score`       |

Always available in chat (when not in strict Experiment policy): **`write_file`**, **`generate_office_file`**, **`view_pdf_pages`**.

## 5. MCP clients (optional)

- [ ] **MCP Clients** tab: add servers (stdio / http / sse) you need (e.g. Playwright, GitHub, custom tools).
- [ ] **Env / secrets** for MCP: `.env` or `mcpClients[].env` — see **docs/CC-CONFIG.md** and **docs/ENVIRONMENT_VARIABLES.md** (`MCP_{id}__KEY` for per-server overrides).
- [ ] **PATH**: packaged Electron extends PATH for stdio servers (`lib/spawn-path.js`).

## 6. Secrets and env

- [ ] Long-lived secrets in **`.env`** (repo root or app data dir), not committed JSON — **docs/ENVIRONMENT_VARIABLES.md**.
- [ ] Keys required by your app (APIs, DB) are available to **terminal** child env only where supported (agent terminal passes a **whitelist** of env vars — see `lib/builtin-agent-tools.js` `getWhitelistedEnv`). If a tool needs extra vars, you may need a small wrapper script or MCP.

## 7. Timeouts and chat

- [ ] **Chat timeout** and **Review timeout** in Settings are large enough for your model and document size.
- [ ] **`num_ctx`** / auto-adjust (if used) for large pastes — Settings and **docs/ENVIRONMENT_VARIABLES.md**.

## 8. Memory (optional)

- [ ] **Memory** tab: enable embedding memory if you want retrieval **per conversation** (`conversationId` on chat) — **lib/memory.js**.

## 9. Experiment mode (optional)

- [ ] **Experiment** mode uses a stricter tool policy; scope is configured via **Experiment** UI / API — not the same as open-ended Chat.

## 10. Modes beyond Chat

For **guided** scaffolding, use **Create** / **Build** wizards and IDE command installs — they are not automatically invoked from Chat alone. Combine **Chat + File Browser + terminal** for iterative development, or switch modes when you want a dedicated flow (**Validate**, **Review**, **Security**, etc.).

## 11. Roadmap and limits

- [ ] **docs/AGENT-APP-CAPABILITIES-ROADMAP.md** — shipped vs planned agent capabilities (Validate/Planner builtins vs optional GSD).
- [ ] **Agent browser** cannot drive `http://localhost:…` for your app UI; use **terminal** (`curl`, tests) or open the app in your OS browser.
- [ ] **Network**: default bind is loopback; remote access needs explicit config — **docs/ENVIRONMENT_VARIABLES.md**, **SECURITY.md**.

---

**Quick verification:** open Chat, set File Browser to your repo, enable agent terminal with `npm` on the allowlist, ask the model to run `npm test` or `npm run build` in a small project and confirm you see real exit codes and output in the thread.
