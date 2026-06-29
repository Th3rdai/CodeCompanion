# VIRA × CodeCompanion Integration

**Nickname:** VIRA COCO  
**Created by:** VIRA (Jarvis) · June 2026  
**Revised by:** Plan Reviewer pass · June 2026

---

## Overview

This document captures the planned integration between **VIRA** (Voice-Interactive Reasoning Agent) and **CodeCompanion** — a locally-hosted AI code reviewer. Together they form _VIRA COCO_: VIRA provides voice, memory, and orchestration; CodeCompanion provides specialised code intelligence via **11 core MCP tools** (6 AI modes + 5 utilities; agent terminal/browser tools excluded via VIRA `include_tools`).

> **Path note:** CodeCompanion is installed at `/Users/james/Projects/CodeCompanion` (canonical). MCP config and integration steps below use this path.

---

## Prerequisites

Before attempting integration, ensure the following are in place:

- **Node.js** ≥ 18 installed (CodeCompanion requirement)
- **CodeCompanion dependencies** installed: `cd /Users/james/Projects/CodeCompanion && npm install`
- **CodeCompanion running** on port 8900 — MCP tools are unavailable if the server is not active
- **Ollama running** (if using local models): `ollama serve` — required for Kimi K2 / Qwen3 tool responses
- **VIRA installed** with MCP extra: `pip install 'vira[mcp]'`
- **VIRA voice extra** (for spoken workflow): `pip install 'vira[voice]'`

---

## CodeCompanion Summary

| Property       | Value                                                                              |
| -------------- | ---------------------------------------------------------------------------------- |
| Location       | `/Users/james/Projects/CodeCompanion`                                              |
| Port           | 8900 (localhost)                                                                   |
| Stack          | Node.js / Express · React / Vite SPA · optional Electron                           |
| Models         | Kimi K2 (chat, review) · Qwen3 (planning, agentic)                                 |
| MCP Server     | `mcp-server.js` — 11 core tools for VIRA (`include_tools`); 19 total if unfiltered |
| Agent Terminal | Enabled                                                                            |
| Agent Browser  | Enabled                                                                            |

---

## MCP Tools Exposed by CodeCompanion

### AI Mode Tools (6)

| Tool                        | Purpose                          |
| --------------------------- | -------------------------------- |
| `codecompanion_chat`        | General AI chat                  |
| `codecompanion_explain`     | Explain code                     |
| `codecompanion_find_bugs`   | Bug and security analysis        |
| `codecompanion_refactor`    | Refactoring suggestions          |
| `codecompanion_tech_to_biz` | Technical → business translation |
| `codecompanion_biz_to_tech` | Business → technical translation |

### Utility Tools (5)

| Tool                               | Purpose                   |
| ---------------------------------- | ------------------------- |
| `codecompanion_list_models`        | List available models     |
| `codecompanion_get_status`         | Server health / status    |
| `codecompanion_browse_files`       | Browse filesystem         |
| `codecompanion_read_file`          | Read a file               |
| `codecompanion_list_conversations` | List conversation history |

### Agent Tools (8 — not exposed to VIRA by default)

> Require **Agent Terminal** and **Agent Browser** enabled in CodeCompanion settings. Omit from VIRA `include_tools` unless you explicitly want them.

| Tool                             | Purpose                        |
| -------------------------------- | ------------------------------ |
| `codecompanion_run_terminal`     | Run a shell command            |
| `codecompanion_kill_process`     | Kill a running process         |
| `codecompanion_tail_process`     | Tail process output            |
| `codecompanion_browse_url`       | Open a URL in headless browser |
| `codecompanion_browser_snapshot` | Capture page snapshot          |
| `codecompanion_browser_click`    | Click page elements            |
| `codecompanion_browser_type`     | Type text into fields          |
| `codecompanion_browser_scroll`   | Scroll page                    |

---

## VIRA Integration Plan

### Step 1 — Install MCP extra

```bash
pip install 'vira[mcp]'
```

### Step 2 — Add to `~/.vira/config.yaml`

```yaml
tools_mcp_servers:
  - name: code_companion
    command: node
    args:
      - mcp-server.js
    cwd: /Users/james/Projects/CodeCompanion
    include_tools: # VIRA: core 11 tools only (excludes agent terminal/browser)
      - codecompanion_chat
      - codecompanion_explain
      - codecompanion_find_bugs
      - codecompanion_refactor
      - codecompanion_tech_to_biz
      - codecompanion_biz_to_tech
      - codecompanion_list_models
      - codecompanion_get_status
      - codecompanion_browse_files
      - codecompanion_read_file
      - codecompanion_list_conversations
```

### Step 3 — Verify tools appear

```bash
vira tools mcp list
# Expected: 11 mcp_code_companion_* tools listed (core set)
```

### Step 4 — CLI or web workflow

**CLI:** `vira chat --tools`, `vira do`, or `vira voice chat --tools`.

**Web:** `vira web` → open the tools drawer → enable **MCP** tools (requires
`web_auth_token` in config and the token pasted in the UI).

1. Start CodeCompanion: `cd /Users/james/Projects/CodeCompanion && npm start`
2. Run VIRA with tools enabled
3. Type: _"Find bugs in auth.js"_ → VIRA calls `mcp_code_companion_codecompanion_find_bugs`

### Step 5 — Voice workflow (Jarvis profile, CLI)

1. Start CodeCompanion (port 8900 must be active)
2. Run: `vira voice chat --tools --profile jarvis`
3. Say a command (see examples below) → VIRA orchestrates the MCP call → Jarvis reads the result aloud

---

## Example Voice Commands

| You say                                 | VIRA calls                   | What happens                     |
| --------------------------------------- | ---------------------------- | -------------------------------- |
| _"Explain this function"_               | `codecompanion_explain`      | Code explanation read aloud      |
| _"Find bugs in auth.js"_                | `codecompanion_find_bugs`    | Bug report with severity ranking |
| _"Refactor this for readability"_       | `codecompanion_refactor`     | Refactoring suggestions          |
| _"Translate this to business language"_ | `codecompanion_tech_to_biz`  | Plain-English summary            |
| _"What models are available?"_          | `codecompanion_list_models`  | Model list read aloud            |
| _"Run the test suite"_                  | `codecompanion_run_terminal` | Terminal command (confirm-gated) |

---

## Obsidian Memory Integration

VIRA's memory vault can enrich CodeCompanion sessions with project context:

1. Add a project note to your vault: `memories/Memory/wiki/CodeCompanion.md`
2. Include architecture decisions, coding standards, and recurring patterns
3. VIRA auto-loads the vault on every session — CodeCompanion MCP calls benefit from this context automatically
4. After a productive session, run `vira memory consolidate <session-file>` to distil insights back into the vault

---

## Security Considerations

> Agent tools carry real risk — treat them accordingly.

- **`codecompanion_run_terminal`** executes shell commands on your machine. VIRA will prompt for confirmation on every call; review carefully before approving.
- **Agent Browser tools** can navigate and interact with live pages. Confirm each browser action.
- CodeCompanion's agent tools respect its own toggle settings — disable Agent Terminal / Agent Browser in CodeCompanion settings if you want to block those tool classes entirely.
- **MCP tools are CLI-only.** `vira web` never exposes MCP tools regardless of settings — this is by design in the VIRA architecture. Use `vira chat --tools` or `vira voice chat --tools` for CodeCompanion MCP access.
- Rotate your VIRA web auth token periodically: `./scripts/Gen_Token.sh`

---

## Troubleshooting

| Symptom                             | Likely cause              | Fix                                            |
| ----------------------------------- | ------------------------- | ---------------------------------------------- |
| `vira tools mcp list` shows nothing | MCP extra not installed   | `pip install 'vira[mcp]'`                      |
| Tools listed but calls fail         | CodeCompanion not running | Start CC on port 8900 first                    |
| `ENOENT mcp-server.js`              | Wrong path in config      | Check actual CC install path                   |
| Tool returns empty result           | Ollama not running        | `ollama serve`                                 |
| Port 8900 in use                    | Another process           | `lsof -i :8900` to identify                    |
| Agent tools missing                 | Toggles off in CC         | Enable Agent Terminal / Browser in CC settings |

---

## Acceptance Criteria

Integration is considered complete when all of the following pass:

| Criterion                            | Expected outcome                                                          |
| ------------------------------------ | ------------------------------------------------------------------------- |
| `vira tools mcp list`                | Lists exactly 11 `mcp_code_companion_*` tools (with `include_tools`)      |
| `vira do "get CodeCompanion status"` | Returns server health from `codecompanion_get_status` without error       |
| `vira chat --tools` bug find         | `codecompanion_find_bugs` returns severity-ranked results for a test file |
| Voice command end-to-end             | Spoken "find bugs in auth.js" → MCP call → Jarvis reads result aloud      |
| Memory enrichment                    | Project note in vault is referenced in a CodeCompanion session response   |
| Agent tool confirmation              | `codecompanion_run_terminal` prompts for confirmation before executing    |

---

## Status Checklist

- [ ] Prerequisites met (Node, npm install, Ollama)
- [ ] `pip install 'vira[mcp]'` completed
- [ ] Config snippet added to `~/.vira/config.yaml`
- [ ] Tools verified with `vira tools mcp list`
- [ ] Web UI workflow tested
- [ ] Voice workflow tested end-to-end
- [ ] Obsidian memory note created for CodeCompanion project

---

_VIRA COCO — VIRA (Jarvis) × CodeCompanion integration plan_  
_th3rdai.com · June 2026_
