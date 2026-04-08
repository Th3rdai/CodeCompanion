# `.cc-config.json` — location and secrets

Code Companion stores most Settings in **`.cc-config.json`** (or **`${CC_DATA_DIR}/.cc-config.json`** in Electron). Treat this file as **private**: it often contains or can contain **secrets and personal paths**.

## Do not commit it (unless you fully understand the risk)

- **`.cc-config.json`** is listed in **`.gitignore`**. Keep it that way for normal development.
- **`CodeCompanion-Data/`** (Electron dev data dir, including its **`.cc-config.json`**) is also **gitignored** — do not force-add it.
- Avoid **`git add -f .cc-config.json`** unless you are deliberately sharing a **sanitized** file (e.g. in a private fork with tokens removed). Even then, prefer **`.env`** + **empty tokens in config** for anything sensitive.

## What can be sensitive

| Area                  | Examples                                                                                                        |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| **GitHub**            | `githubToken`, `githubTokens[].token`                                                                           |
| **Ollama Cloud**      | `ollamaApiKey`                                                                                                  |
| **Docling**           | `docling.apiKey`                                                                                                |
| **MCP stdio clients** | `mcpClients[].env` (e.g. `GITHUB_PERSONAL_ACCESS_TOKEN`, API keys)                                              |
| **License**           | `license.key` (if set)                                                                                          |
| **Paths**             | `projectFolder`, `icmTemplatePath`, `brandAssets[].path`, `makerFrameworkPath` — usernames and directory layout |

HTTP/SSE MCP entries usually store only a **`url`**; secrets there are uncommon unless you put tokens in the URL (avoid that).

## Safer patterns

- Put long-lived secrets in **`.env`** (also gitignored) where Code Companion supports overrides — see **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** (`OLLAMA_API_KEY`, `GITHUB_TOKEN`, `MCP_{id}__…`, etc.).
- Use **Settings** in the app to persist config locally without editing JSON by hand.
- For **team defaults** without secrets, use the committed **`.cc-config.json.example`** in the repo (no tokens; optional **Archon** MCP URL on loopback). Copy to a **local** **`.cc-config.json`** and customize:

  ```bash
  cp .cc-config.json.example .cc-config.json
  ```

  Then open **Settings** or edit **`.cc-config.json`** — never commit the copy.

## Where the file lives

See **[TROUBLESHOOTING.md — MCP clients missing](./TROUBLESHOOTING.md#mcp-clients-missing-in-settings)** (same table applies to the whole config file).

## Related

- **`.cc-config.json.example`** (repo root) — committed template; copy locally, do not commit **`.cc-config.json`**.
- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** — env vs config precedence, sensitive routes.
- **[ARCHON-MCP.md](./ARCHON-MCP.md)** — example `mcpClients` entry (no secrets for default Archon HTTP).
