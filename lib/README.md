# `lib/` — backend modules

Flat layout (63 modules at repo root of `lib/`). Grouped by domain for navigation; **paths are not subfolders** until a future incremental move (see `docs/REORGPLAN.md` Phase 5).

## AI & chat

| Module                 | Role                                      |
| ---------------------- | ----------------------------------------- |
| `ollama-client.js`     | Ollama REST, streaming, structured output |
| `openrouter-client.js` | OpenRouter API client                     |
| `auto-model.js`        | Per-mode default when toolbar = Auto      |
| `prompts.js`           | System prompts per mode                   |
| `chat-post-handler.js` | `POST /api/chat` orchestration            |
| `tool-call-handler.js` | MCP + builtin tool execution loop         |

## Review & builders

| Module                       | Role                      |
| ---------------------------- | ------------------------- |
| `review.js`                  | Code review orchestration |
| `review-service.js`          | Review API service layer  |
| `review-schema.js`           | Review JSON schema        |
| `review-validate-context.js` | Review context validation |
| `score-service.js`           | Builder score API         |
| `builder-score.js`           | Builder scoring logic     |
| `builder-schemas.js`         | Builder Zod/schemas       |

## Security & audit

| Module                | Role                               |
| --------------------- | ---------------------------------- |
| `security-helpers.js` | Loopback, API key, path allowlists |
| `pentest.js`          | OWASP pentest orchestration        |
| `pentest-service.js`  | Pentest API layer                  |
| `pentest-schema.js`   | Pentest JSON schema                |
| `terminal-audit.js`   | Agent terminal audit log           |
| `audit-log.js`        | Structured audit logging           |

## MCP clients

| Module                            | Role                            |
| --------------------------------- | ------------------------------- |
| `mcp-client-manager.js`           | External MCP client connections |
| `mcp-api-routes.js`               | MCP client HTTP routes          |
| `mcp-http.js`                     | Built-in MCP HTTP transport     |
| `resolve-mcp-test-config-root.js` | MCP smoke-test config path      |

Top-level **`mcp/`** (not here) registers built-in server tools.

## Files & history

| Module                     | Role                         |
| -------------------------- | ---------------------------- |
| `file-browser.js`          | Project tree, read/save      |
| `history.js`               | Conversation persistence     |
| `history-folders.js`       | History folder CRUD          |
| `history-compaction.js`    | History compaction           |
| `office-generator.js`      | Chat/office export formats   |
| `builtin-doc-converter.js` | Built-in document conversion |

## Integrations

| Module                  | Role                          |
| ----------------------- | ----------------------------- |
| `github.js`             | GitHub clone/browse API       |
| `docling-client.js`     | Docling-serve client          |
| `docling-starter.js`    | Docling auto-start (web)      |
| `gsd-bridge.js`         | GSD CLI bridge                |
| `dictate-transcribe.js` | Voice dictation transcription |

## Scaffold & validate

| Module                | Role                   |
| --------------------- | ---------------------- |
| `icm-scaffolder.js`   | Create mode scaffolder |
| `build-scaffolder.js` | Build mode scaffolder  |
| `build-registry.js`   | Build project registry |
| `maker-skill.js`      | Maker skill helpers    |
| `validate.js`         | Validate mode scanner  |

## Experiment

| Module                      | Role                   |
| --------------------------- | ---------------------- |
| `experiment-store.js`       | Experiment persistence |
| `experiment-schema.js`      | Experiment schema      |
| `experiment-step-parser.js` | Step parser            |

## Agent & tools

| Module                        | Role                                    |
| ----------------------------- | --------------------------------------- |
| `builtin-agent-tools.js`      | Builtin `run_terminal_cmd`, files, etc. |
| `agent-app-skills.js`         | Agent app skills                        |
| `agent-app-skill-envelope.js` | Skill envelope                          |
| `agent-interaction-root.js`   | Agent interaction root                  |
| `browser-intent.js`           | Browser intent handling                 |
| `tool-result-artifacts.js`    | Tool result artifacts                   |

## Core

| Module                     | Role                        |
| -------------------------- | --------------------------- |
| `config.js`                | `.cc-config.json` load/save |
| `logger.js`                | `app.log` / `debug.log`     |
| `client-errors.js`         | Generic 5xx/SSE messages    |
| `rate-limiter.js`          | Rate limit factory          |
| `rate-limiters-config.js`  | Route limiter config        |
| `spawn-path.js`            | PATH for stdio MCP/Electron |
| `host-time.js`             | Host time helpers           |
| `memory.js`                | Embedding memory            |
| `context-budget.js`        | Server context budget       |
| `image-processor.js`       | Image attachments           |
| `setup-services.js`        | Setup assistant services    |
| `setup-assistant-json.js`  | Setup assistant JSON        |
| `compliance-mappings.js`   | Compliance mappings         |
| `brand-context.js`         | Brand context for prompts   |
| `mac-codesign-identity.js` | macOS codesign helper       |

**Frontend:** `src/lib/context-budget.js` is separate from `lib/context-budget.js`.
