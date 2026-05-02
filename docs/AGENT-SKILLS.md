# Agent App Skills

> First-party Code Companion features (Review, Security scan, Builder score) called from the **Chat** agent as bounded builtin tools. Plan: **`AGENTSKILL.md`**.

## Status

| Skill                         | v1.6.32     | Default | Settings toggle                               |
| ----------------------------- | ----------- | ------- | --------------------------------------------- |
| `builtin.review_run`          | ✅          | **off** | Settings → Agent → App Skills → Review        |
| `builtin.pentest_scan`        | ✅          | **off** | Settings → Agent → App Skills → Security scan |
| `builtin.pentest_scan_folder` | ✅          | **off** | Settings → Agent → App Skills → Security scan |
| `builtin.builder_score`       | ✅          | **off** | Settings → Agent → App Skills → Builder score |
| `builtin.experiment_*`        | ❌ deferred | —       | Use **Experiment mode** instead               |
| `builtin.pentest_remediate`   | ❌ excluded | —       | High blast radius; not callable from Chat     |

## Enable

Two toggles per family — **both** must be on for the tool to appear:

1. **Master**: Settings → General → **Agent app skills** (`agentAppSkills.enabled`, default `false`)
2. **Family**: Review / Security / Builder score (per-family flags, default `false`)

When either is off, the tool is **absent from the prompt** and returns `{ ok: false, code: "TOOL_DISABLED" }` if forced.

## Tool reference

### `builtin.review_run`

Same AI review as **Review mode** in the app. Reuses `lib/review.js#reviewCode` via the shared `runReviewSnippetPhase` service that `POST /api/review` also calls.

| Arg          | Type              | Notes                                                                                                                      |
| ------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `model`      | string (required) | Concrete Ollama name or `"auto"` (resolves to `mode=review` per `autoModelMap`).                                           |
| `code`       | string            | Inline source. Either `code` or `sourcePath` is required.                                                                  |
| `sourcePath` | string            | Path under the configured project folder. Resolved server-side; symlink escapes rejected via `isWithinBasePath`. Max 2 MB. |
| `filename`   | string            | Optional. Influences validate-context lookup.                                                                              |
| `images`     | array             | Optional. Max 10 items.                                                                                                    |

**Example:**

```
TOOL_CALL: builtin.review_run({"model": "auto", "sourcePath": "src/app.js"})
```

### `builtin.pentest_scan`

OWASP-style single-snippet security scan. Calls `lib/pentest.js#pentestCode` via `runPentestSnippetPhase`.

| Arg          | Type              | Notes                                              |
| ------------ | ----------------- | -------------------------------------------------- |
| `model`      | string (required) | Concrete or `"auto"` (resolves to `mode=pentest`). |
| `code`       | string            | Either `code` or `sourcePath` required.            |
| `sourcePath` | string            | Same path rules as `review_run`.                   |
| `filename`   | string            | Optional.                                          |
| `images`     | array             | Optional. Max 10.                                  |

### `builtin.pentest_scan_folder`

Folder-level OWASP scan. Same size/file caps as Security mode (`maxFiles: 80`, `maxTotalSize: 2 MB`). Calls `lib/pentest.js#pentestFolder` via `runPentestFolderPhase`.

| Arg      | Type              | Notes                          |
| -------- | ----------------- | ------------------------------ |
| `model`  | string (required) | Concrete or `"auto"`.          |
| `folder` | string (required) | Path under the project folder. |

### `builtin.builder_score`

Score Prompting / Skillz / Agentic / Planner content. Calls `lib/builder-score.js#scoreContent` via `runBuilderScorePhase` — same path as `POST /api/score`.

| Arg        | Type              | Notes                                                      |
| ---------- | ----------------- | ---------------------------------------------------------- |
| `model`    | string (required) | Concrete or `"auto"` (resolves to the requested mode key). |
| `mode`     | enum (required)   | `prompting`, `skillz`, `agentic`, or `planner`.            |
| `content`  | string (required) | Content to score (markdown, prompt, etc.).                 |
| `metadata` | object            | Optional context.                                          |

## Result envelopes (pinned, AGENTSKILL §5.0.1 / §5.0.2)

Every successful call returns:

```json
{
  "ok": true,
  "type": "report-card" | "summary",
  "data": { /* schema-validated payload, e.g. ReportCardSchema for review */ },
  "summary": "string",
  "truncated": false,
  "model": "qwen3-32k:latest",
  "durationMs": 18420
}
```

Every failure returns:

```json
{
  "ok": false,
  "code": "TOOL_DISABLED" | "AUTH_FAILED" | "TIMEOUT" | "PATH_DENIED" | "MODEL_FAILED" | "INVALID_ARGS" | "RATE_LIMITED",
  "message": "human-readable description",
  "hint": "optional next step"
}
```

The agent can switch on `code` to choose recovery; `message` is shown to the user verbatim.

## Abort behavior

**Stop** in chat aborts the SSE response, which propagates an `AbortSignal` through the chat handler → tool dispatcher → service function → Ollama `fetch`. Both `chatStream` and `chatStructured` honor the signal as of **v1.6.32** (`chatStructured`'s abort wiring was the Phase 0.5 fix in this release; previously it dropped `abortSignal` and only honored its internal timeout).

If a structured (Zod-validated) call fails partway, the service consumes the chat-fallback stream into a single summary string (capped at ~100K chars; `truncated: true` flag set if hit). The agent sees a `type: "summary"` envelope with the prose.

## Audit log

Each invocation writes one `[SKILL_AUDIT]` line to `app.log`:

```
[INFO] [SKILL_AUDIT] {"skill":"review_run","ok":true,"model":"qwen3-32k:latest","durationMs":18420,"truncated":false}
[INFO] [SKILL_AUDIT] {"skill":"pentest_scan","ok":false,"model":"minimax-m2:cloud","durationMs":3120,"truncated":false,"code":"MODEL_FAILED"}
```

Fields: `skill`, `ok`, `model`, `durationMs`, `truncated`, `code` (when `ok: false`), `summaryChars` (when `type: "summary"`). No raw code, no secrets, no path data beyond what HTTP routes already log.

## Experiment mode

Experiment-from-Chat is **deferred for v1**. None of the new builtins are added to `EXPERIMENT_ALLOWED_BUILTINS` — when `mode === "experiment"`, only the existing tight allowlist (`run_terminal_cmd`, `write_file`, `view_pdf_pages`, `validate_scan_project`, `validate_generate_command`) is callable. Use **Experiment mode** in the app for hypothesis-driven runs; use the new builtins from regular chat.

## Single source of truth

Every skill calls the same shared service module that the HTTP route uses:

| Builtin               | Shared service                                  | HTTP route                 |
| --------------------- | ----------------------------------------------- | -------------------------- |
| `review_run`          | `lib/review-service.js#runReviewSnippetPhase`   | `POST /api/review`         |
| `pentest_scan`        | `lib/pentest-service.js#runPentestSnippetPhase` | `POST /api/pentest`        |
| `pentest_scan_folder` | `lib/pentest-service.js#runPentestFolderPhase`  | `POST /api/pentest/folder` |
| `builder_score`       | `lib/score-service.js#runBuilderScorePhase`     | `POST /api/score`          |

Validation, auto-model resolution, and the call into the underlying `reviewCode` / `pentestCode` / `scoreContent` only live once — drift between agent and UI is structurally prevented.

## Out of scope

- **`pentest_remediate`** — patch-generation surface; not callable from Chat (high blast radius). Use the **Remediate** button in Security mode.
- **Create / Build wizards** — heavy UX coupling; agents return structured results instead of opening tabs.
- **GSD bridge** — roadmap Phase 3 (`docs/AGENT-APP-CAPABILITIES-ROADMAP.md`); read-only / allowlisted, default off.

## Troubleshooting

**Tool not appearing in agent prompt** — check both master `agentAppSkills.enabled` AND the family flag. The tool is filtered out of `getBuiltinTools` when either is false.

**`code: "PATH_DENIED"`** — `sourcePath` resolved outside `config.projectFolder`. Move the file into the project or pass inline `code` instead.

**`code: "MODEL_FAILED"`** — Ollama unreachable or returned non-JSON. Check `ollamaUrl` in Settings; verify the model name; for `"auto"`, check `autoModelMap[mode]` in `.cc-config.json`.

**`code: "TIMEOUT"`** — user clicked **Stop** OR the call exceeded 600s default. Bump `chatTimeoutSec` in Settings.

**`code: "RATE_LIMITED"`** — same per-route limiter that protects the HTTP API. Wait 30-60s.

## See also

- **`AGENTSKILL.md`** — full plan with phase breakdown, envelope contracts, experiment-mode interaction.
- **`docs/AGENTSKILL-plan-review.md`** — three plan-reviewer passes; final verdict READY.
- **`docs/AGENT-APP-CAPABILITIES-ROADMAP.md`** — Phase 3 (Validate + GSD); future expansion.
