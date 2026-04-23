---
description: Comprehensive validation for Code Companion — Vibe Coder Edition
---

# Validate Code Companion

> Run from project root (`AIApp-CodeCompanion/`). Validates build, tests, API endpoints, and user workflows for this Node.js + React app powered by local Ollama LLMs.

## Phase 1: Build Verification

The frontend must compile cleanly. Build errors block everything else.

!`npx vite build`

Expected: `dist/` produced with no errors. Chunk size warnings are acceptable. Mermaid chunk should be separate (~500KB).

!`node -e "const fs = require('fs'); const idx = fs.existsSync('dist/index.html'); console.log(idx ? 'dist/index.html exists' : 'MISSING dist/index.html'); process.exit(idx ? 0 : 1)"`

Expected: `dist/index.html exists`

!`node -e "const fs = require('fs'); const files = fs.readdirSync('dist/assets').filter(f => f.includes('mermaid')); console.log(files.length > 0 ? 'Mermaid chunk: OK (' + files[0] + ')' : 'Mermaid chunk: MISSING'); process.exit(files.length > 0 ? 0 : 1)"`

Expected: Mermaid chunk exists as separate file (lazy-loaded).

## Phase 2: Server Startup & Health

Start the server and verify Express + Ollama connectivity. Auto-detects HTTP vs HTTPS.

!`kill $(lsof -ti:8903) 2>/dev/null; PORT=8903 node server.js &`
!`sleep 3 && (curl -ksf --max-time 10 https://127.0.0.1:8903/ > /dev/null 2>&1 && echo "EXPRESS_PROTO=https" || (curl -sf --max-time 10 http://127.0.0.1:8903/ > /dev/null 2>&1 && echo "EXPRESS_PROTO=http" || echo "Express: FAIL"))`

Expected: `EXPRESS_PROTO=https` (if certs exist) or `EXPRESS_PROTO=http`

!`curl -sf --max-time 5 http://localhost:11434/api/tags > /dev/null && echo "Ollama: reachable" || echo "Ollama: not running (P7 chat/review tests will be skipped)"`

Note: Ollama being offline is acceptable — the app handles this gracefully.

> **Note:** All remaining curl commands use `-k` flag and try HTTPS first, falling back to HTTP. If your server runs HTTP-only, both work.

## Phase 3: Unit & Security Tests

These use `node:test` (not Playwright). Run with `node --test`.

!`node --test tests/mcp-security.test.js tests/tone-validation.test.js tests/ui-labels.test.js`

Expected: all pass (MCP security, tone validation, UI labels).

!`node --test tests/rate-limit.test.js`

Expected: rate limiting test passes. Requires server running (P2).

## Phase 4: UI Component Tests

Playwright browser tests for interactive UI elements. Requires built frontend (P1) and server (P2).

`playwright.config.js` starts **webServer** with **`FORCE_HTTP=1`** on **4173**; default **`BASE_URL`** is **`http://127.0.0.1:4173`** (do not use HTTPS unless the server under test is HTTPS). Same as `npm run test:ui` — optionally `npx playwright test tests/ui/ --project=chromium`.

!`npx playwright test tests/ui/`

**Coverage areas:**
- `tests/ui/onboarding.spec.js` — OnboardingWizard flow, localStorage persistence
- `tests/ui/privacy-banner.spec.js` — Privacy banner visibility
- `tests/ui/glossary.spec.js` — Jargon glossary search and tooltip
- `tests/ui/loading-animation.spec.js` — Review loading animation
- `tests/ui/report-card-interactions.spec.js` — Report card grades and export
- `tests/ui/input-methods.spec.js` — Code input via paste, upload, browse tabs
- `tests/ui/JargonGlossary.spec.jsx` — JargonGlossary component
- `tests/ui/OnboardingWizard.spec.jsx` — OnboardingWizard component
- `tests/ui/builder-prompting.spec.js` — Prompting builder UI

Expected: all UI tests pass.

## Phase 5: End-to-End Tests

Full browser + server workflow tests.

!`npx playwright test tests/e2e/`

**Coverage areas:**
- `tests/e2e/review-workflow.spec.js` — paste code, submit review, receive report card

Expected: E2E tests pass (uses mocked API).

## Phase 6: API Endpoint Smoke Tests

Verify all major API routes respond correctly. Server must be running on port 8903 (P2).

### Configuration & Models
!`curl -ksf https://127.0.0.1:8903/api/config | node -e "process.stdin.on('data',d=>{const c=JSON.parse(d);console.log('Config:',c.ollamaUrl?'OK':'MISSING ollamaUrl')})"`
!`curl -ksf https://127.0.0.1:8903/api/models | node -e "process.stdin.on('data',d=>{const m=JSON.parse(d);console.log('Models:',m.models?m.models.length+' found':'ERROR')})"`

### Conversation History CRUD
!`curl -ksf -X POST https://127.0.0.1:8903/api/history -H 'Content-Type: application/json' -d '{"id":"validate-test","title":"Validation Test","messages":[{"role":"user","content":"test"}]}' && echo "History save: OK"`
!`curl -ksf https://127.0.0.1:8903/api/history | node -e "process.stdin.on('data',d=>{const h=JSON.parse(d);console.log('History list:',Array.isArray(h)?'OK':'ERROR')})"`

> **Large history:** If `GET /api/history` returns a very large JSON body, piping straight to `JSON.parse` in a one-liner may fail. Prefer `curl -ksf … -o /tmp/h.json` then `node -e "JSON.parse(require('fs').readFileSync('/tmp/h.json'))"` or use `jq`.
!`curl -ksf https://127.0.0.1:8903/api/history/validate-test | node -e "process.stdin.on('data',d=>{const h=JSON.parse(d);console.log('History get:',h.id==='validate-test'?'OK':'ERROR')})"`
!`curl -ksf -X DELETE https://127.0.0.1:8903/api/history/validate-test && echo "History delete: OK"`

### File Browser (path traversal protection)
!`curl -ksf "https://127.0.0.1:8903/api/files/tree" | node -e "process.stdin.on('data',d=>{const t=JSON.parse(d);console.log('File tree:',t.root?'OK':'ERROR')})"`

> **Huge trees:** If the configured project folder is very large, unscoped `GET /api/files/tree` may return megabytes. For smoke tests, add `folder=` (URL-encoded project path) to scope the tree, or write the response to a file before parsing.
!`curl -ksf "https://127.0.0.1:8903/api/files/read?path=package.json" | node -e "process.stdin.on('data',d=>{const f=JSON.parse(d);console.log('File read:',f.content?'OK':'ERROR')})"`
!`STATUS=$(curl -ksw "%{http_code}" "https://127.0.0.1:8903/api/files/read?path=../../etc/passwd" -o /dev/null); test "$STATUS" = "200" && echo "Path traversal blocked: FAIL (status: $STATUS)" || echo "Path traversal blocked: OK (status: $STATUS)"`

### File Save with Backup
!`echo "validate-test" > /tmp/cc-validate-test.txt && curl -ksf -X POST https://127.0.0.1:8903/api/files/save -H 'Content-Type: application/json' -d '{"filePath":"/tmp/cc-validate-test.txt","folder":"/tmp","content":"updated"}' | node -e "process.stdin.on('data',d=>{const r=JSON.parse(d);console.log('File save:',r.success?'OK':'ERROR');console.log('Backup created:',r.backedUp?'OK':'NO')})"`
!`rm -f /tmp/cc-validate-test.txt /tmp/cc-validate-test.txt.bak 2>/dev/null; echo "Cleanup: OK"`
!`STATUS=$(curl -ksw "%{http_code}" -X POST "https://127.0.0.1:8903/api/files/save" -H 'Content-Type: application/json' -d '{"filePath":"../../etc/evil","folder":"'$(pwd)'","content":"x"}' -o /dev/null); test "$STATUS" = "200" && echo "Save path traversal blocked: FAIL (status: $STATUS)" || echo "Save path traversal blocked: OK (status: $STATUS)"`

### GitHub Integration
!`curl -ksf https://127.0.0.1:8903/api/github/token/status | node -e "process.stdin.on('data',d=>{const s=JSON.parse(d);console.log('GitHub token status:','configured' in s?'OK':'ERROR')})"`
!`curl -ksf https://127.0.0.1:8903/api/github/repos | node -e "process.stdin.on('data',d=>{const r=JSON.parse(d);console.log('GitHub repos:',r.repos?'OK':'ERROR')})"`

### MCP HTTP Endpoint
!`curl -ksf -X POST https://127.0.0.1:8903/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"validate","version":"1.0"}}}' | node -e "process.stdin.on('data',d=>{const r=JSON.parse(d);console.log('MCP initialize:',r.result?'OK':'ERROR')})"`

## Phase 7: User Workflow Smoke Tests

These mirror actual user journeys from README.md. Requires **Ollama** and a **running app server** (same host/port as P2/P6 — e.g. `https://127.0.0.1:8903` or `http://127.0.0.1:4173`).

**Strict green (recommended):** run the bundled script once instead of short-timeout curls. It **pre-warms** the chosen model via Ollama `POST /api/generate` (cold loads can exceed 60s), uses **long SSE timeouts** (default 300s per request), accepts **review** as either JSON report card or SSE, and requires **at least 11** MCP tools (more when external MCPs are connected).

!`VALIDATE_BASE_URL="${VALIDATE_BASE_URL:-http://127.0.0.1:4173}" npm run validate:p7`

Environment (optional):

| Variable | Default | Purpose |
|----------|---------|---------|
| `VALIDATE_BASE_URL` | `http://127.0.0.1:4173` (override to match P2/P6, e.g. `https://127.0.0.1:8903`) | App root for `/api/chat`, `/api/review`, `/mcp` |
| `VALIDATE_P7_MODEL` | auto-pick from `/api/models` | Pin a model if auto-pick is wrong |
| `VALIDATE_P7_WARM_SEC` | `240` | Ollama cold-load warm timeout |
| `VALIDATE_P7_CHAT_SEC` | `300` | Per-request SSE timeout (chat + diagram; review same cap) |
| `VALIDATE_P7_MIN_MCP_TOOLS` | `11` | Minimum `tools/list` count |
| `OLLAMA_URL` | `http://127.0.0.1:11434` | Warm-up target |

Expected: script prints `P7: all workflow checks passed.` and exits `0`.

### Workflow 4: File Browser (still via curl if you skip the script)
!`curl -ksf "https://127.0.0.1:8903/api/files/tree?depth=2" | node -e "process.stdin.on('data',d=>{const t=JSON.parse(d);console.log('Browse files:',t.tree&&t.tree.length>0?'OK ('+t.tree.length+' items)':'check shape')})"`

### Cleanup
!`kill $(lsof -ti:8903) 2>/dev/null; echo "Test server stopped"`

## Summary

| Phase | What | Pass Criteria |
|-------|------|---------------|
| P1 | Build | `dist/index.html` produced cleanly, mermaid chunk separate |
| P2 | Server | Express responds on :8903, Ollama status checked |
| P3 | Unit/Security | node:test tests pass (mcp-security, tone, labels, rate-limit) |
| P4 | UI Components | Playwright UI specs pass |
| P5 | E2E | Review-workflow E2E specs pass |
| P6 | API Smoke | All endpoints return expected status/shape, file save + backup works, path traversal blocked |
| P7 | User Workflows | `npm run validate:p7` passes (warm + long-timeout chat/review/diagram, MCP ≥ 11, 12 mode prompts); optional file-browser curl above |

**Hard pass:** P1 through P6 must all succeed. P7 requires Ollama.

## Journal Entry (required after running)

1. **Ensure `journal/` exists:**
!`mkdir -p journal`

2. **Append one line to `journal/YYYY-MM-DD.md`** (use today's date):
   ```
   HH:MM | Pass/Fail | E:N W:M | P1:OK P2:OK P3:OK P4:... P5:... P6:OK P7:OK | optional note
   ```
   Example: `15:50 | Pass | E:0 W:2 | P1:OK P2:OK P3:OK P4:OK P5:OK P6:OK P7:OK | 12 modes, mermaid chunk, file save+backup`

3. **Update `journal/README.md`** with one line per date for that day's latest outcome.
