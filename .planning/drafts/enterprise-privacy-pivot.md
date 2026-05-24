# CodeCompanion — Enterprise Privacy Pivot: Action Plan

> **For coding agents (Claude, Cursor, etc.):** This document is your implementation guide. Read it top to bottom before writing a single line of code. It contains the full context, codebase quick-reference, and phased build-out you need to execute the enterprise pivot safely.

---

## Context: What We're Building Toward

CodeCompanion is an AI-powered code review tool that currently runs on the user's local machine against a locally-hosted Ollama LLM. The enterprise pivot repositions it as **"private code review for teams who can't send code to the cloud"** — targeting law firms, healthcare, defense contractors, and financial services companies who need OWASP-mapped security assessments with compliance evidence, all running on their own servers with no data leaving their network.

**The core value proposition:** Same AI-powered OWASP security reviews, same report-card grading system — but fully on-premises, audit-logged, and mapped to NIST 800-53 / SOC 2 / HIPAA / PCI-DSS control IDs. No cloud dependency, no data residency risk.

**The pivot does NOT require rebuilding the product.** The security review engine, OWASP assessment logic, and report generation already work. We need to add the enterprise deployment layer on top.

---

## Codebase Quick Reference

Before touching anything, orient yourself:

| What you need                                   | Where it lives                                            |
| ----------------------------------------------- | --------------------------------------------------------- |
| Express app + all API routes                    | `server.js`                                               |
| Security review logic (OWASP)                   | `lib/review.js`                                           |
| Report generation (PDF via pdfkit, DOCX, XLSX)  | `lib/office-generator.js`                                 |
| App config (reads `.cc-config.json`)            | `lib/config.js`                                           |
| Security helpers (localhost gate, API key auth) | `lib/security-helpers.js`                                 |
| MCP route registrations                         | `lib/mcp-api-routes.js`                                   |
| Main React app (18 modes, routing)              | `src/App.jsx`                                             |
| Security mode UI                                | `src/components/SecurityPanel.jsx` + `SecurityReport.jsx` |
| Settings panel (6 tabs)                         | `src/components/SettingsPanel.jsx`                        |
| Electron main process                           | `electron/main.js`                                        |
| Electron packager config                        | `electron-builder.config.js`                              |
| Unit tests                                      | `tests/unit/` (node:test runner)                          |
| Integration tests                               | `tests/integration/` (`npm run test:integration`)         |
| E2E / Playwright                                | `tests/ui/`, `tests/e2e/`                                 |

**Security middleware pattern — read this before adding any route:**
`lib/security-helpers.js` exports `createRequireLocalOrApiKey({ log })` — a factory. It is called once at server startup (line ~80 of `server.js`) to produce `requireLocalOrApiKey`, which is the actual Express middleware. When adding new protected routes, use the already-instantiated `requireLocalOrApiKey` — do NOT call the factory again.

```js
// Already done in server.js — do not repeat:
const requireLocalOrApiKey = createRequireLocalOrApiKey({ log });

// Use it like this on new routes:
app.get('/api/audit', requireLocalOrApiKey, (req, res) => { ... });
```

**Critical rule:** When adding a new top-level directory (e.g. `routes/`, `workers/`), add a `"newdir/**/*"` entry to the `files` array in `electron-builder.config.js`. Missing entries = startup crash in every shipped installer.

**Server binding:** The server currently defaults to `127.0.0.1`. `CC_BIND_ALL=1` or `HOST=0.0.0.0` opens it to the LAN. Docker requires `HOST=0.0.0.0`.

---

## What Already Exists — Do Not Rebuild

These features are already shipped and working. Do not recreate them:

- **OWASP security assessment** — multi-file, folder scanning, 6 categories, letter grades (`SecurityPanel.jsx`, `lib/review.js`)
- **Report export** — PDF, DOCX, HTML, CSV, JSON export of security findings (`lib/office-generator.js`, `ExportPanel.jsx`)
- **MCP server** — built-in HTTP + stdio MCP endpoint (`mcp-server.js`, `mcp/`)
- **API key auth** — `CC_API_SECRET` / `X-CC-API-Key` header gate for non-loopback requests (`lib/security-helpers.js`)
- **Conversation history + JSON storage** — `lib/history.js`, no external DB needed
- **AI model integration** — Ollama REST client with streaming SSE, configurable URL (`lib/ollama-client.js`)
- **Self-signed HTTPS** — `deploy.sh` generates cert, `startup.sh` does protocol-aware health checks
- **Rate limiting** — `express-rate-limit` is already in the project; apply it to new auth routes

---

## Phase 1 — Must-Have Before First Enterprise Sale

These three sprints are blockers. No enterprise customer will evaluate without Docker deployment and an audit trail. Complete in order.

---

### Sprint 1: Docker / Server Deployment Mode

**Goal:** Any sysadmin can run `docker compose up` and have a working CodeCompanion instance in under 5 minutes.

**Deliverables:**

**`Dockerfile`** (project root) — use a multi-stage build:

```dockerfile
# Stage 1: build the React frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: runtime — server only, no build deps
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server.js mcp-server.js ./
COPY lib/ ./lib/
COPY mcp/ ./mcp/
COPY IDE_COMMANDS/ ./IDE_COMMANDS/
COPY --from=builder /app/dist ./dist
ENV HOST=0.0.0.0
ENV PORT=8900
EXPOSE 8900
CMD ["node", "server.js"]
```

Do NOT include `electron/` — this is the web server only.

**`docker-compose.yml`** (project root) — note: no `version:` key (deprecated in Compose v2):

```yaml
services:
  codecompanion:
    build: .
    ports:
      - "8900:8900"
    volumes:
      - cc_data:/app/CodeCompanion-Data
    environment:
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=8900
      - CC_API_SECRET=${CC_API_SECRET:-changeme}
      - OLLAMA_URL=http://ollama:11434
    restart: unless-stopped
    depends_on:
      - ollama
  ollama:
    image: ollama/ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
volumes:
  cc_data:
  ollama_data:
```

**`.dockerignore`** (project root):

- Exclude: `node_modules`, `electron/`, `.git`, `*.log`, `CodeCompanion-Data/`, `.cc-config.json`

**Add `/api/health` endpoint to `server.js`** (register before the SPA fallback):

```js
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", version: require("./package.json").version });
});
```

**`scripts/smoke-test-docker.sh`** — spins up via compose, polls `/api/health` until ready (max 60s), asserts 200, tears down.

**Add to `package.json` scripts:**

```json
"smoke:docker": "bash scripts/smoke-test-docker.sh"
```

**`docs/DOCKER-DEPLOY.md`**

- Step-by-step: prerequisites (Docker 24+, docker compose v2), clone, `docker compose up -d`, verify at `http://localhost:8900`
- Environment variable reference table: `CC_API_SECRET`, `HOST`, `PORT`, `OLLAMA_URL`, `CC_BIND_ALL`
- Volume paths: where data persists, how to back it up
- Note: `OLLAMA_URL` must point to the Ollama service (`http://ollama:11434` in compose, or your Ollama server's LAN address if running externally)
- Updating: `docker compose pull && docker compose up -d --build`

**Acceptance criteria:**

- `docker compose up` succeeds cold (no pre-existing config)
- Frontend loads at `http://localhost:8900`
- `/api/health` returns `{ status: 'ok' }`
- Security review runs end-to-end (CodeCompanion → Ollama sidecar at `http://ollama:11434`)
- Data survives `docker compose restart`
- `npm run smoke:docker` passes

---

### Sprint 2: Audit Log System + Multi-User Support

**Goal:** Every security review action is logged with who did it and when. Admin can export the log as evidence for a compliance audit.

#### Part A — Audit Log

**`lib/audit-log.js`** — new file

- Uses JSON-lines format (one JSON object per line, newline-delimited) appended to `{dataDir}/audit.log`
- Export a single `logEvent(event)` function
- Event shape:

```json
{
  "ts": "2026-05-03T21:00:00.000Z",
  "event": "review.completed",
  "userId": "james@example.com",
  "ip": "192.168.1.10",
  "meta": { "filesScanned": 3, "grade": "B", "owasp": ["A01", "A03"] }
}
```

- Event types to log: `auth.login`, `auth.logout`, `auth.failed`, `review.started`, `review.completed`, `review.exported`, `settings.changed`, `user.created`, `user.deleted`
- The log file must never be deleted via the API — append-only

**New API routes** (register in `server.js` before the SPA fallback, protected with `requireLocalOrApiKey`):

- `GET /api/audit` — returns last N events (default 200), supports `?limit=`, `?event=`, `?userId=` query filters
- `GET /api/audit/export` — streams the full `audit.log` file as a download (`Content-Disposition: attachment; filename="audit-export-{date}.log"`). Admin session required in multi-user mode.

**Wire into existing routes:**

- Add `logEvent()` calls in `lib/review.js` (review.started / review.completed)
- Add `logEvent()` in any route that calls `lib/office-generator.js` for security exports (review.exported)
- Add `logEvent()` in settings save route (settings.changed)

#### Part B — Multi-User Support

Enterprise customers need named user accounts so the audit log shows _who_ did the review, not just an IP address.

**`lib/users.js`** — new file

- JSON file store at `{dataDir}/users.json`
- Functions: `createUser(email, password, role)`, `verifyUser(email, password)`, `listUsers()`, `deleteUser(id)`, `getUserById(id)`
- Passwords hashed with `bcrypt` (cost factor 12). Add `bcrypt` to `package.json` dependencies.
- Roles: `admin`, `reviewer` (admin can manage users + view audit log; reviewer can run reviews)
- First user created is always admin
- If `users.json` does not exist, the app runs in **single-user mode** (no login required — preserves current behavior for all existing users exactly as-is)
- **Rollback:** To revert from multi-user to single-user mode at any time, rename or delete `{dataDir}/users.json` and restart the server. All active sessions will be cleared.

**Session middleware** — add `express-session` with `session-file-store` to `server.js`:

- Session secret from `CC_SESSION_SECRET` env var
- **If `CC_SESSION_SECRET` is not set in multi-user mode:** generate a random secret once, persist it to `.cc-config.json` as `sessionSecret`, and reuse it on every restart. Do NOT generate an ephemeral secret — ephemeral secrets invalidate all sessions on every restart.
- Sessions stored in `{dataDir}/sessions/`
- Only activate session middleware when `users.json` exists (multi-user mode)

**CSRF protection** — when session middleware is active, also add CSRF middleware (`csurf` package):

- Generate a CSRF token per session
- Expose it via `GET /api/auth/csrf-token`
- Require the token on all state-mutating routes (`POST`, `PUT`, `PATCH`, `DELETE`) when session mode is active
- The SPA must fetch the token on load and include it as `X-CSRF-Token` header

**Rate limiting on auth routes** — using the already-present `express-rate-limit`:

```js
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
app.use("/api/auth", authLimiter);
```

**New auth routes** (register in `server.js`):

- `POST /api/auth/login` — verifies credentials, creates session, logs `auth.login`; on failure logs `auth.failed`
- `POST /api/auth/logout` — destroys session, logs `auth.logout`
- `GET /api/auth/me` — returns current user (or `null` in single-user mode)
- `GET /api/auth/csrf-token` — returns CSRF token for the current session

**New user management routes:**

- `GET /api/users` — admin only, list all users
- `POST /api/users` — admin only, create user. Body: `{ email, password, role }`
- `DELETE /api/users/:id` — admin only, delete user

**`src/components/LoginScreen.jsx`** — new component

- Simple centered card: email + password fields, "Sign In" button
- Show on app load if `/api/auth/me` returns `null` and multi-user mode is active
- On success, set user in `App.jsx` state and render normally

**`src/components/UserManagementPanel.jsx`** — new component

- Table of users (email, role, created date)
- "Add User" button (opens inline form: email, password, role dropdown)
- "Delete" button per row (with confirmation)
- Add as a new tab in `SettingsPanel.jsx` (visible to admin role only)

**Acceptance criteria:**

- In single-user mode (no `users.json`): app behaves exactly as today — no login, no change, no regressions
- In multi-user mode: unauthenticated requests to `/api/*` (except `/api/health`, `/api/auth/login`, `/api/auth/csrf-token`) return 401
- CSRF token required on all POST/PUT/DELETE when sessions are active; missing token returns 403
- Failed login is rate-limited to 10 attempts per 15-minute window per IP
- Admin can create/delete users via Settings → Users tab
- Every review generates an audit event with `userId` set to the logged-in user's email
- `GET /api/audit/export` downloads a valid JSON-lines file
- Server restart does NOT log out existing users (session secret persists)

---

### Sprint 3: Compliance Framework Mapping + Audit-Ready Reports

**Goal:** Security reports show which OWASP findings map to which compliance control IDs (NIST, SOC 2, HIPAA, PCI-DSS), and generate a compliance-ready PDF report an auditor can accept as evidence.

#### Part A — Compliance Mappings

**`lib/compliance-mappings.js`** — new file

Source control IDs from:

- **NIST:** NIST SP 800-53 Rev 5 — https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final
- **OWASP → NIST mapping:** https://owasp.org/www-project-cyber-controls/
- **SOC 2:** AICPA Trust Services Criteria (2017)
- **HIPAA:** 45 CFR Part 164 Security Rule
- **PCI-DSS:** PCI DSS v4.0

Export a `COMPLIANCE_MAP` object keyed by OWASP category ID:

```js
module.exports.COMPLIANCE_MAP = {
  A01: {
    label: "Broken Access Control",
    nist: ["AC-3", "AC-6", "SI-10"],
    soc2: ["CC6.1", "CC6.3"],
    hipaa: ["§164.312(a)(1)", "§164.312(a)(2)(i)"],
    pci: ["6.4.1", "7.2"],
  },
  // ... A02–A10
};
```

Export a `getControlsForFindings(findings)` function that takes an array of OWASP finding objects (each with an `owaspId` or `category` field) and returns a deduplicated list of triggered controls per framework:

```js
// Returns: { nist: [...], soc2: [...], hipaa: [...], pci: [...] }
```

**Wire into `lib/review.js`:**

- After the AI generates findings, call `getControlsForFindings(findings)` and attach the result to the review response as `complianceControls: { nist: [...], soc2: [...], hipaa: [...], pci: [...] }`

**Wire into `SecurityReport.jsx`:**

- Below the existing OWASP category grades, add a "Compliance Controls Triggered" collapsible section
- Show four sub-sections (NIST / SOC 2 / HIPAA / PCI-DSS), each listing the triggered control IDs

#### Part B — Audit-Ready PDF Report

**`lib/office-generator.js`** — add `generateAuditReport(reviewData, options)` function:

- Uses the existing `pdfkit` pipeline already in this file (see `generatePdf()` for the pattern)
- `reviewData` shape: `{ files: [...], findings: [...], grades: {...}, complianceControls: {...}, model: string }`
- `options` shape: `{ organizationName: string, outputPath: string }`
- Report sections:
  1. Cover page — organization name, report date, reviewed files list, overall grade
  2. Executive summary — findings severity distribution (critical/high/medium/low counts)
  3. Findings by OWASP category — grade, finding count, brief description per category
  4. Compliance control mapping table — columns: Framework | Control ID | Description
  5. Appendix — full file list scanned, AI model used, CodeCompanion version
- Footer on every page: "Confidential — Generated by CodeCompanion vX.X.X — {date}"

**New config field:**

- Add `organizationName` (string, default `""`) to `.cc-config.json` schema and `.cc-config.json.example`
- Add an "Organization Name" text field to Settings → General tab

**New API route:**

- `POST /api/security/compliance-report` — accepts `{ reviewId }` or `{ reviewData }`, calls `generateAuditReport()`, returns PDF as download

**`src/components/SecurityReport.jsx`:**

- Add a "Generate Compliance Report" button next to existing export buttons
- On click, POST to `/api/security/compliance-report`, trigger file download

**Acceptance criteria:**

- Every OWASP finding in a security review shows mapped NIST / SOC 2 / HIPAA / PCI-DSS controls
- "Generate Compliance Report" button produces a downloadable PDF
- PDF contains: org name, date, findings, compliance table, page numbers, confidential footer
- Report opens correctly in Adobe Reader and macOS Preview

---

## Phase 2 — After First Revenue

Do not start Phase 2 until at least one paying customer is using Phase 1.

### SSO / SAML Integration

- Add `passport-saml` support for Okta, Azure AD, Google Workspace (prioritize in that order)
- New config section: `sso: { enabled, entryPoint, issuer, cert }`
- Login screen shows "Sign in with SSO" button when configured

### CI/CD Integration

- Document calling `POST /api/review` from GitHub Actions / GitLab CI / Jenkins
- Provide example workflow files in `docs/ci-examples/`
- Support `fail-on-grade` parameter: exit code 1 if overall grade is below threshold

### Air-Gap Deployment Bundle

- Script that packages CodeCompanion + Ollama model weights into a transferable archive
- For defense/classified environments with no internet access

---

## Phase 3 — Go-to-Market Infrastructure

Start after Phase 2 is validated with at least 3 customers.

### Landing Page

- Simple static site targeting compliance buyers
- Key messages: on-prem, OWASP + NIST + SOC 2 mapped, evidence-grade reports, no data leaves your network
- CTA: "Request a pilot"

### Pilot Onboarding Package

- 30-minute onboarding script
- Pre-configured docker-compose
- 90-day trial license mechanism

---

## Coding Standards

- **No external databases.** Use JSON files in `{dataDir}/` for all new storage (`lib/config.js` provides `dataDir`).
- **SSE for streaming.** All AI responses stream via Server-Sent Events. Follow existing route patterns in `server.js`.
- **Error handling.** Use `lib/client-errors.js` for 5xx / SSE messages. Never expose stack traces to the client.
- **Security middleware.** Use the already-instantiated `requireLocalOrApiKey` from `server.js` — do not call the factory again. See the Codebase Quick Reference section above.
- **Tests.** Every new `lib/` module gets a unit test in `tests/unit/`. Use Node's built-in `node:test` runner (not Jest).
- **No new top-level dirs without updating `electron-builder.config.js`.**
- **Prettier.** Run `npm run format` before committing.
- **No `console.log` in production paths** — use `console.debug`.

---

## Definition of Done Checklist

- [ ] `npm run validate:fast` passes (lint + type check + unit tests + integration + smoke)
- [ ] `npm run test:integration` passes
- [ ] New lib modules have unit tests in `tests/unit/`
- [ ] No new `console.log` calls in production code paths
- [ ] `npm run format` run and committed
- [ ] `electron-builder.config.js` updated if any new top-level directory was added
- [ ] `docs/` updated with any new environment variables or config fields
- [ ] `.cc-config.json.example` updated with any new config keys
- [ ] CHANGELOG.md entry written for the sprint
- [ ] `scripts/smoke-test-server.js` passes

---

## Questions to Ask James Before Each Sprint

**Before Sprint 1:**

1. Should the Docker image include a pre-pulled Ollama model, or assume Ollama is managed separately?
2. Preferred base model for docker-compose Ollama service (e.g. `llama3.2`, `codellama`, `qwen2.5-coder`)?
3. Target org name for `.cc-config.json.example` — or default to "Your Organization"?

**Before Sprint 2:**

1. Password policy: minimum length, complexity requirements?
2. Failed login lockout: 10 attempts / 15 min window acceptable, or stricter?
3. Audit log retention: indefinite or configurable window?

**Before Sprint 3:**

1. Which SAML IdPs are highest priority (Okta, Azure AD, Google Workspace)?
2. Any pilot customers already need air-gap deployment?
