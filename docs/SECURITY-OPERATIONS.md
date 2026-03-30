# Security operations index

Quick map of **network/API hardening**, assessment artifacts, and related env vars for **Code Companion** maintainers.

| Topic                                                                                            | Document / code                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Environment variables** (`CC_BIND_ALL`, `CC_API_SECRET`, `VITE_CC_API_KEY`, CORS, rate limits) | [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)                                                                                                                                                      |
| **Vulnerability reporting & threat model**                                                       | [../SECURITY.md](../SECURITY.md)                                                                                                                                                                            |
| **Static pen-test report (OWASP) + remediations log**                                            | [PENTEST-REPORT-CodeCompanion-Static-Analysis.md](./PENTEST-REPORT-CodeCompanion-Static-Analysis.md)                                                                                                        |
| **Releases, electron-updater, code-signing env**                                                 | [RELEASES-AND-UPDATES.md](./RELEASES-AND-UPDATES.md), [BUILD.md](../BUILD.md) (macOS / Windows / Linux), [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) (`MAC_*`, `WIN_*` / `CSC_*`, `LINUX_GPG_*`) |
| **Server middleware & path allowlists**                                                          | `lib/security-helpers.js`, `server.js`                                                                                                                                                                      |
| **SPA authenticated fetch (optional LAN)**                                                       | `src/lib/api-fetch.js`                                                                                                                                                                                      |
| **SCA (dependency audit)**                                                                       | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — `npm audit --audit-level=critical` on push/PR; run `npm audit` locally for full report                                                          |

## Defaults (2026-03+)

- HTTP server binds to **`127.0.0.1`** unless **`CC_BIND_ALL=1`** or **`HOST=0.0.0.0`**.
- **Sensitive** routes (Settings save, GitHub token/status, file save, validate install, logs, MCP): **loopback** or **`X-CC-API-Key`** === **`CC_API_SECRET`**.
- **CORS**: localhost / `127.0.0.1` origins by default; **`CC_CORS_ALLOW_LAN=1`** or **`CC_ALLOWED_ORIGINS`** for broader browser origins.

## Dependency / supply-chain (SCA)

- **CI gate:** pushes and PRs to `main`/`master` run `npm audit --audit-level=critical` after `npm ci`, unit tests, and `npm run build`.
- **Full audit:** run `npm audit` locally. **SheetJS `xlsx`** was removed (prototype-pollution advisories); spreadsheets use **exceljs** / **read-excel-file**. **`file-type`** is overridden to **≥21.3.1** with an **officeparser** patch for ESM compatibility (`patches/officeparser+6.0.4.patch`). Re-run `npm audit` after dependency changes.

## Archon

Project tasks for security work live in **Archon** under **Code Companion — Vibe Coder Edition**; search for feature **Security** or titles containing **OWASP** / **Network API**.
