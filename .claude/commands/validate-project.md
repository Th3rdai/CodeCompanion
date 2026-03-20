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
!`curl -ksf https://127.0.0.1:8903/api/history/validate-test | node -e "process.stdin.on('data',d=>{const h=JSON.parse(d);console.log('History get:',h.id==='validate-test'?'OK':'ERROR')})"`
!`curl -ksf -X DELETE https://127.0.0.1:8903/api/history/validate-test && echo "History delete: OK"`

### File Browser (path traversal protection)
!`curl -ksf "https://127.0.0.1:8903/api/files/tree" | node -e "process.stdin.on('data',d=>{const t=JSON.parse(d);console.log('File tree:',t.root?'OK':'ERROR')})"`
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

These mirror actual user journeys from README.md. Requires Ollama running.

### Workflow 1: Chat Mode (SSE streaming)
!`curl -ks -N -X POST https://127.0.0.1:8903/api/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"Say hello in one word"}],"mode":"chat","model":"qwen3:latest"}' --max-time 15 | head -c 300 | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('Chat SSE:',d.includes('data:') ? 'OK' : 'NO STREAM'))"`

Expected: SSE stream with `data:` lines (requires Ollama + model).

### Workflow 2: Code Review with Report Card
!`curl -ks -N -X POST https://127.0.0.1:8903/api/review -H 'Content-Type: application/json' -d '{"code":"function add(a,b){return a+b}","language":"javascript","model":"qwen3:latest"}' --max-time 60 | head -c 300 | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('Review:',d.length>10?'OK (got response)':'NO RESPONSE'))"`

Expected: JSON report card with grades or SSE fallback.

### Workflow 3: Diagram Mode (mermaid in response)
!`curl -ks -N -X POST https://127.0.0.1:8903/api/chat -H 'Content-Type: application/json' -d '{"messages":[{"role":"user","content":"Draw a simple flowchart: Start -> Process -> End"}],"mode":"diagram","model":"qwen3:latest"}' --max-time 30 | head -c 500 | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('Diagram mode:',d.includes('data:') ? 'OK (streaming)' : 'NO STREAM'))"`

Expected: SSE stream with mermaid content (requires Ollama).

### Workflow 4: File Browser
!`curl -ksf "https://127.0.0.1:8903/api/files/tree?depth=2" | node -e "process.stdin.on('data',d=>{const t=JSON.parse(d);console.log('Browse files:',t.tree&&t.tree.length>0?'OK ('+t.tree.length+' items)':'check shape')})"`

### Workflow 5: MCP Tool Discovery
!`curl -ksf -X POST https://127.0.0.1:8903/mcp -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node -e "process.stdin.on('data',d=>{const r=JSON.parse(d);const n=r.result&&r.result.tools?r.result.tools.length:0;console.log('MCP tools:',n===11?'OK (11 tools)':'UNEXPECTED ('+n+')')})"`

Expected: 11 MCP tools listed.

### Workflow 6: Mode Prompt Validation
!`node -e 'var p=require("./lib/prompts");var modes=["chat","explain","bugs","refactor","translate-tech","translate-biz","diagram","review","create","prompting","skillz","agentic"];var missing=modes.filter(function(m){return p.SYSTEM_PROMPTS[m]===undefined});console.log(missing.length===0?"All 12 mode prompts: OK":"MISSING: "+missing.join(", "));process.exit(missing.length)'`

Expected: All 12 mode prompts present in SYSTEM_PROMPTS.

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
| P7 | User Workflows | Chat SSE streams, review returns report card, diagram mode streams, MCP lists 11 tools, all 12 mode prompts exist |

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
