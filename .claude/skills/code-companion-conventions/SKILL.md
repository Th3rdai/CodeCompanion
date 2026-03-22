---
name: code-companion-conventions
description: Project-specific rules for Code Companion — read before large refactors or UI/server/MCP changes. Points to canonical docs (CLAUDE.md, BUILD.md, design-system, planning mappers).
---

# Code Companion — project conventions

Use this skill when editing **Express** (`server.js`), **React** (`src/App.jsx`, `src/components/`), **Electron** (`electron/`), **MCP** (`mcp/`, `lib/tool-call-handler.js`, `lib/builtin-agent-tools.js`), or **desktop release** flows.

## Always re-read

| Topic | File |
|-------|------|
| Product + stack + modes | `CLAUDE.md` |
| Desktop build, updater patch, installers | `BUILD.md` |
| Layout / glass / root container rules | `design-system/DESIGN-STANDARDS.md` |
| Agent terminal / builtin tools | `CLIPLAN.md`, `lib/builtin-agent-tools.js` |
| Architecture map (optional) | `.planning/codebase/ARCHITECTURE.md` |

## Non-negotiables

- **Root layout:** `fixed inset-0` — not `h-screen` / `h-dvh` on the app shell (see DESIGN-STANDARDS).
- **Chat stop:** `AbortController` in `App.jsx`; server `chatAbortController` in `server.js` — do not remove without replacing cancellation.
- **electron-updater:** `patches/electron-updater+*.patch` applied via `patch-package` on `npm install`.
- **MCP stdio in Electron:** PATH extended via `lib/spawn-path.js` — do not assume full shell PATH in packaged app.
- **Secrets:** Do not commit `.cc-config.json` with tokens; hooks block direct edits to sensitive paths (see `.claude/hooks/`).

## Testing touchpoints

After changing `lib/`, `server.js`, or `mcp/`, run `FORCE_HTTP=1 npm run test:unit` (or rely on PostToolUse hook if enabled).
