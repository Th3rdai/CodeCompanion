# Security Assessment Report
## Target: Th3rdAI Code Companion — http://HOST_IP:3000/

| Field | Value |
|---|---|
| **Date** | 2026-03-14 |
| **Assessor** | Agent Zero — Automated Security Assessment |
| **Scope** | http://HOST_IP:3000/ and all services on HOST_IP |
| **Authorization** | Authorized by asset owner |
| **Overall Risk** | 🔴 CRITICAL |

---

## 1. Executive Summary

A high-level security assessment was performed against the **Th3rdAI Code Companion**, a local AI-powered coding assistant built on an Express.js backend with a React/Vite SPA frontend. The application interfaces with Ollama (local LLM inference), GitHub via Personal Access Tokens, Archon MCP server, and various developer tools.

**The assessment revealed a critically insecure posture.** The application has **zero authentication** on its entire API surface, directly exposing GitHub Personal Access Tokens in plaintext, full AI conversation history, internal system configuration, filesystem paths, and unauthenticated triggers for code execution — all accessible to any host on the local network.

The broader host compounds this by exposing multiple unauthenticated services including a fully open Ollama AI inference API (24 models) and an Archon MCP server.

> ⚠️ **IMMEDIATE ACTION REQUIRED:** Two GitHub Personal Access Tokens are exposed in plaintext via an unauthenticated endpoint and must be **revoked immediately** at https://github.com/settings/tokens

| Severity | Count |
|---|---|
| 🔴 Critical | 3 |
| 🟠 High | 7 |
| 🟡 Medium | 5 |
| 🔵 Low / Info | 4 |
| **Total** | **19** |

---

## 2. Host & Service Inventory

| Port | Service | Auth | Notes |
|---|---|---|---|
| 22 | SSH | Unknown | Standard SSH daemon |
| 3000 | Th3rdAI Code Companion (Express.js) | ❌ None | **Primary target** |
| 5000 | Unknown service | Unknown | Not responding to HTTP |
| 8000 | Unknown service | Unknown | Not responding to HTTP |
| 8051 | Archon MCP Server | ❌ None | AI agent orchestration |
| 8888 | Unknown Web App | ✅ Has /login | Redirects to login page |
| 11434 | Ollama AI Inference API | ❌ None | 24 AI models exposed |

**Technology Stack (Port 3000):**
- Backend: Node.js / Express.js
- Frontend: React + Vite (SPA)
- AI Runtime: Ollama (local), Claude Code (Anthropic)
- Server header: `X-Powered-By: Express`
- WAF: None detected
- HTTPS: Not available — HTTP only
- CORS: No policy configured

---

## 3. Findings Summary Table

| # | Severity | Title | Location | OWASP |
|---|---|---|---|---|
| F-01 | 🔴 Critical | GitHub PAT Tokens Exposed in Plaintext | `GET /api/config` | A02, A05 |
| F-02 | 🔴 Critical | Complete Absence of API Authentication | All `/api/*` endpoints | A01 |
| F-03 | 🔴 Critical | Unauthenticated Code Execution Trigger | `POST /api/launch-*` | A01 |
| F-04 | 🟠 High | Ollama AI API Fully Exposed (No Auth) | Port 11434 | A01 |
| F-05 | 🟠 High | Full Chat History Exposed Without Auth | `GET /api/history` | A01 |
| F-06 | 🟠 High | Complete Absence of HTTP Security Headers | All responses | A05 |
| F-07 | 🟠 High | No HTTPS — All Traffic in Plaintext | Entire application | A02 |
| F-08 | 🟠 High | No CORS Policy Configured | All API responses | A05 |
| F-09 | 🟠 High | Internal System Configuration Disclosed | `GET /api/config` | A05 |
| F-10 | 🟠 High | Unauthenticated MCP Server State Control | `POST /api/mcp/server/toggle` | A01 |
| F-11 | 🟡 Medium | Archon MCP Server Exposed on Network | Port 8051 | A05 |
| F-12 | 🟡 Medium | Internal Filesystem Paths Disclosed | `/api/config`, `/api/files/tree` | A05 |
| F-13 | 🟡 Medium | Technology Stack Fingerprinting | `X-Powered-By: Express` header | A05 |
| F-14 | 🟡 Medium | No Web Application Firewall | Network perimeter | A05 |
| F-15 | 🟡 Medium | Unidentified Services on Open Ports | Ports 5000, 8000 | A05 |
| F-16 | 🔵 Low | No Rate Limiting on Any Endpoint | All API endpoints | A04 |
| F-17 | 🔵 Low | AI Model Inventory Fully Disclosed | `GET /api/models` | A05 |
| F-18 | 🔵 Info | SPA Catch-All Returns 200 for All Routes | Undefined routes | Info |
| F-19 | 🔵 Info | MCP Client Configurations Exposed | `GET /api/mcp/clients` | A05 |

---

## 4. Detailed Findings

---

### F-01 🔴 CRITICAL — GitHub Personal Access Tokens Exposed in Plaintext

**Endpoint:** `GET http://HOST_IP:3000/api/config`  
**Authentication Required:** None  
**OWASP:** A02 Cryptographic Failures, A05 Security Misconfiguration  

**Description:**  
The `/api/config` endpoint returns the full application configuration as plaintext JSON with no authentication. This includes two GitHub Personal Access Tokens (PATs) in complete, unredacted form.

**Evidence:**
```json
{
  "mcpClients": [
    {
      "id": "github-3rdaai-admin",
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "github_pat_11B4IT67I0eDRvX5obcuHE_...[FULL TOKEN EXPOSED]" }
    },
    {
      "id": "github-3rdai-bill",
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "github_pat_11B4IT67I02A59GUhmxbII_...[FULL TOKEN EXPOSED]" }
    }
  ],
  "ollamaUrl": "http://localhost:11434",
  "icmTemplatePath": "/Users/james/AI_Dev/ICM_FW/ICM-Framework-Template",
  "projectFolder": "/Users/james/AI_Dev/tests/codecomp"
}
```

**Impact:**  
Any user on the local network can retrieve these tokens and use them to: access/modify GitHub repositories, read CI/CD secrets, manage org members, and potentially gain full organizational GitHub access if tokens have admin scope.

**Recommendations:**
1. **IMMEDIATELY revoke both tokens** at https://github.com/settings/tokens
2. Audit GitHub token usage logs for unauthorized access
3. Generate replacement tokens with minimal required scopes
4. Store secrets in environment variables server-side only — never return them in API responses
5. Add authentication to `/api/config` and strip all secret fields from the response


---

### F-02 🔴 CRITICAL — Complete Absence of API Authentication

**Endpoint:** All `GET/POST /api/*` endpoints  
**Authentication Required:** None  
**OWASP:** A01 Broken Access Control  

**Description:**  
Every API endpoint is accessible without any authentication — no session tokens, API keys, HTTP Basic Auth, or JWT. Any host on the local network can perform any operation the application supports.

**Verified Unauthenticated Endpoints:**
```
GET  /api/config                → Full app config + secrets
GET  /api/models                → AI model inventory
GET  /api/history               → All chat sessions
GET  /api/history/{id}          → Full conversation content
GET  /api/git/status            → Git repository status
GET  /api/github/repos          → GitHub repository list
GET  /api/mcp/clients           → MCP client configurations
GET  /api/mcp/server/status     → Internal server info
GET  /api/files/tree            → Project directory tree
POST /api/launch-claude-code    → Triggers host code execution
POST /api/launch-cursor         → Triggers IDE launch on host
POST /api/mcp/server/toggle     → Toggles MCP server state
POST /api/github/token          → Sets GitHub token
POST /api/chat                  → Sends arbitrary prompts to AI
```

**Recommendations:**
1. Implement global authentication middleware on all `/api/*` routes
2. For single-user local tool: generate a random API key at startup, require as Bearer token
3. Bind Express to `127.0.0.1` instead of `0.0.0.0` if only local machine access is needed
4. Example: `app.use("/api", requireAuth)` middleware before all route registration

---

### F-03 🔴 CRITICAL — Unauthenticated Code Execution Trigger

**Endpoint:** `POST /api/launch-claude-code`, `POST /api/launch-cursor`, `POST /api/launch-windsurf`  
**Authentication Required:** None  
**OWASP:** A01 Broken Access Control  

**Description:**  
Endpoints that trigger IDE tools and code execution environments on the host OS are accessible without authentication from any network host.

**Evidence:**
```bash
$ curl -X POST http://HOST_IP:3000/api/launch-claude-code \
  -H "Content-Type: application/json" -d "{}"
{"success":true,"folder":"/Users/james/AI_Dev/tests/codecomp"}
```

**Attack Chain:**
1. Attacker sends malicious prompt via unauthenticated `POST /api/chat`
2. AI assistant executes attacker-influenced code operations on host
3. `POST /api/launch-claude-code` triggers Claude Code with compromised project state
4. Result: indirect remote code execution on host machine

**Recommendations:**
1. Require authentication on all launch endpoints
2. Validate and sanitize `projectPath` to prevent path traversal
3. Restrict these endpoints to localhost-only connections
4. Implement request origin validation

---

### F-04 🟠 HIGH — Ollama AI API Fully Exposed Without Authentication

**Endpoint:** `http://HOST_IP:11434`  
**Authentication Required:** None  
**OWASP:** A01 Broken Access Control  

**Description:**  
The Ollama AI inference server is bound to all network interfaces and accessible from the local network without authentication. 24 AI models are fully accessible to any network host.

**Evidence:**
```bash
$ curl http://HOST_IP:11434/
Ollama is running

$ curl http://HOST_IP:11434/api/tags  # 24 models returned:
glm-4.6:cloud, qwen3-8b-util, qwen3-32k, qwen3-coder:30b,
devstral-small-2, bazobehram/qwen3-14b-claude-4.5-opus-high-reasoning,
incept5/llama3.1-claude, glm-4.7-flash, nomic-embed-text ... (24 total)
```

**Impact:** Any network user can send unlimited inference requests consuming GPU/CPU resources and abuse the compute infrastructure for malicious content generation.

**Recommendations:**
1. Bind Ollama to localhost only: set `OLLAMA_HOST=127.0.0.1` in environment config
2. If network access is required, add nginx reverse proxy with authentication in front
3. Implement request rate limiting per client IP

---

### F-05 🟠 HIGH — Full Chat History Exposed Without Authentication

**Endpoint:** `GET /api/history`, `GET /api/history/{id}`  
**Authentication Required:** None  
**OWASP:** A01 Broken Access Control  

**Description:**  
All AI conversation history is accessible without authentication. Sessions contain complete message threads including code, internal configurations, and sensitive system details.

**Evidence (session list sample):**
```json
[
  {"id": "ab3c6cbb", "title": "{mcpServers: archon, ip: HOST_IP:8051}", "mode": "refactor"},
  {"id": "8f07293e", "title": "Is it possible to inspect and review binaries?", "mode": "chat"},
  {"id": "44a79176", "title": "GSD P3 Tests: buggy-discount.js", "mode": "refactor"}
]
```

**Recommendations:**
1. Require authentication to access all history endpoints
2. Encrypt stored conversation history at rest
3. Implement access control so users can only access their own sessions

---

### F-06 🟠 HIGH — Complete Absence of HTTP Security Headers

**Endpoint:** All HTTP responses  
**OWASP:** A05 Security Misconfiguration  

**Evidence:**
```http
HTTP/1.1 200 OK
X-Powered-By: Express
Content-Type: text/html; charset=UTF-8
[NO SECURITY HEADERS PRESENT]
```

**Missing Headers:**

| Header | Risk if Missing |
|---|---|
| `Content-Security-Policy` | XSS, code injection |
| `Strict-Transport-Security` | SSL stripping, MITM |
| `X-Frame-Options` | Clickjacking |
| `X-Content-Type-Options` | MIME sniffing attacks |
| `Referrer-Policy` | Information leakage |
| `Permissions-Policy` | Feature/API abuse |
| `Cross-Origin-Opener-Policy` | Cross-origin attacks |

**Recommendation:** Add `helmet` middleware: `npm install helmet` then `app.use(helmet())`

---

### F-07 🟠 HIGH — No HTTPS — All Traffic Transmitted in Plaintext

**OWASP:** A02 Cryptographic Failures  

**Description:**  
The application runs on HTTP only. All data including GitHub tokens, AI conversations, and configuration is transmitted in cleartext and is trivially interceptable on the local network.

**Evidence:**
```bash
$ curl -sk https://HOST_IP:3000/  →  HTTP 000 (connection refused - no TLS)
$ curl -sk https://HOST_IP:443/   →  HTTP 000 (no TLS on any port)
```

**Recommendations:**
1. Generate a local TLS certificate using `mkcert` for development
2. Configure Express HTTPS or place nginx/caddy as TLS-terminating reverse proxy
3. Redirect all HTTP traffic to HTTPS

---

### F-08 🟠 HIGH — No CORS Policy Configured

**OWASP:** A05 Security Misconfiguration  

**Description:**  
No CORS headers are returned on any API response. Any website a user visits could make cross-origin requests to the API and read full responses, enabling CSRF-style data theft.

**Evidence:**
```bash
$ curl -I -H "Origin: https://evil.com" http://HOST_IP:3000/api/config
# Response: NO Access-Control-Allow-Origin or any CORS headers returned
```

**Recommendation:** Configure explicit CORS allowlist: `app.use(cors({ origin: ["http://localhost:3000"] }))` — deny all other origins by default.

---

### F-09 🟠 HIGH — Internal System Configuration Disclosed

**Endpoints:** `GET /api/config`, `GET /api/models`, `GET /api/mcp/clients`  
**OWASP:** A05 Security Misconfiguration  

**Disclosed Information:**
- Full filesystem paths: `/Users/james/AI_Dev/ICM_FW/ICM-Framework-Template`
- Internal service URLs: `http://localhost:11434`, `http://HOST_IP:8051`
- OS type and developer username: `james` (macOS)
- MCP server configurations and client IDs
- All installed AI model names and versions
- GitHub account identifiers (`github-3rdaai-admin`, `github-3rdai-bill`)

**Recommendation:** Audit all API responses and remove internal paths, usernames, service URLs, and configuration details not required by the frontend.

---

### F-10 🟠 HIGH — Unauthenticated MCP Server State Control

**Endpoint:** `POST /api/mcp/server/toggle`  
**Authentication Required:** None  
**OWASP:** A01 Broken Access Control  

**Description:**  
Any network user can toggle MCP server connections on/off without authentication, disrupting AI assistant functionality and potentially forcing reconnections to attacker-controlled endpoints.

**Recommendations:**
1. Require authentication on all state-changing endpoints
2. Implement audit logging for all MCP server state changes
3. Validate server URLs before allowing toggle operations

---

## Medium Severity Findings

### F-11 🟡 MEDIUM — Archon MCP Server Exposed on Network

**Endpoint:** `http://HOST_IP:8051`  
**Authentication Required:** None  
**OWASP:** A05 Security Misconfiguration  

**Description:**  
The Archon MCP (Model Context Protocol) server is bound to all network interfaces. The `/mcp` SSE endpoint is active and referenced in exposed chat history, allowing unauthenticated interaction with the AI agent orchestration layer from any local network host.

**Evidence:**
```bash
$ curl http://HOST_IP:8051/
HTTP 404
$ curl http://HOST_IP:8051/mcp
# SSE stream opens successfully - no auth required
```

**Recommendations:**
1. Bind Archon to `127.0.0.1` only
2. If network access is required, add authentication at the proxy layer
3. Audit what operations are exposed via the MCP SSE endpoint

---

### F-12 🟡 MEDIUM — Internal Filesystem Paths Disclosed

**Endpoints:** `GET /api/config`, `GET /api/files/tree`, `POST /api/launch-*`  
**OWASP:** A05 Security Misconfiguration  

**Description:**  
Multiple API responses disclose full host filesystem paths, revealing the OS type, developer username, and project directory structure. This information significantly aids targeted attacks.

**Disclosed Paths:**
```
/Users/james/AI_Dev/ICM_FW/ICM-Framework-Template
/Users/james/AI_Dev/tests/codecomp
/Users/james/AI_Dev/...
```
Reveals: macOS host, username `james`, full project tree structure.

**Recommendation:** Strip all absolute filesystem paths from API responses. Use relative paths or abstract project identifiers instead.

---

### F-13 🟡 MEDIUM — Technology Stack Fingerprinting

**Header:** `X-Powered-By: Express`  
**OWASP:** A05 Security Misconfiguration  

**Description:**  
The server advertises its framework via the `X-Powered-By` response header. Combined with other disclosed information (Node.js, Express, specific npm packages), an attacker can precisely target known vulnerabilities for this stack version.

**Evidence:**
```http
HTTP/1.1 200 OK
X-Powered-By: Express
```

**Recommendation:** Remove with `app.disable("x-powered-by")` or via helmet: `app.use(helmet.hidePoweredBy())`

---

### F-14 🟡 MEDIUM — No Rate Limiting on Any Endpoint

**OWASP:** A04 Insecure Design  

**Description:**  
No rate limiting is applied to any endpoint. This enables brute force attacks, resource exhaustion via unlimited AI inference requests, and automated bulk data harvesting of chat history and configuration.

**Attack Scenarios:**
- Flood `POST /api/chat` → exhaust GPU/API credits
- Enumerate all `/api/history/{id}` → harvest all conversations
- Flood launch endpoints → repeatedly spawn IDE processes on host

**Recommendations:**
1. Add `express-rate-limit` middleware: `npm install express-rate-limit`
2. Apply stricter limits to compute-heavy endpoints (`/api/chat`, `/api/launch-*`)
3. Implement per-IP throttling

---

### F-15 🟡 MEDIUM — Unidentified Services on Open Ports

**Ports:** 5000/tcp, 8000/tcp  
**OWASP:** A05 Security Misconfiguration  

**Description:**  
Ports 5000 and 8000 are open and listening but did not respond to standard HTTP probes. Their purpose, authentication requirements, and security posture are unknown. Unidentified open services represent an unknown attack surface.

**Evidence:**
```
nmap: 5000/tcp open  upnp?
nmap: 8000/tcp open  http-alt?
curl http://HOST_IP:5000/  → no HTTP response
curl http://HOST_IP:8000/  → no HTTP response
```

**Recommendations:**
1. Identify and document all services running on these ports
2. Close any ports not required for application operation
3. Apply host-based firewall rules to restrict access to known-required ports only

---

## Low / Informational Findings

### F-16 🔵 LOW — No Web Application Firewall Detected

**OWASP:** A05 Security Misconfiguration  

**Description:**  
No WAF is present at any layer (network, host, or application). The application has no automated protection against common attack patterns, injection attempts, or malicious scanners.

**Evidence:**
```bash
$ wafw00f http://HOST_IP:3000/
No WAF detected
```

**Recommendation:** For a development tool, at minimum add `express-validator` for input validation and `express-rate-limit` for throttling. For production, consider a WAF layer.

---

### F-17 🔵 LOW — SSH Service Exposed on Network

**Port:** 22/tcp  
**OWASP:** A05 Security Misconfiguration  

**Description:**  
SSH is accessible from the local network. While SSH itself is not a vulnerability, its exposure combined with the other findings (disclosed username `james`, internal paths) provides additional attack surface for credential-based attacks.

**Recommendations:**
1. Disable password authentication — use SSH keys only (`PasswordAuthentication no`)
2. Restrict SSH access to specific trusted IPs via firewall rules
3. Consider changing the default port to reduce automated scanning noise

---

### F-18 🔵 LOW — Verbose Error Messages May Leak Stack Traces

**OWASP:** A05 Security Misconfiguration  

**Description:**  
Express.js in development mode returns verbose error messages including stack traces, file paths, and internal state. If `NODE_ENV` is not set to `production`, errors will expose internal implementation details.

**Recommendation:**
1. Set `NODE_ENV=production` in the deployment environment
2. Implement a global error handler that returns generic error messages to clients
3. Log detailed errors server-side only

---

### F-19 ℹ️ INFO — Application Runs as Development Server

**OWASP:** A05 Security Misconfiguration  

**Description:**  
The application appears to be running as a development server (Express default configuration, no process manager, no reverse proxy). This is informational but indicates the deployment lacks production hardening.

**Observations:**
- No reverse proxy (nginx/caddy) in front of Express
- No process manager (PM2/systemd) detected
- Development-style CORS and error handling
- Direct port exposure without load balancer

**Recommendation:** If this tool is used regularly, consider wrapping it with a proper process manager and reverse proxy even for local use.

---

## 5. Prioritized Recommendations

### 🚨 Immediate Actions (Do Today)

| Priority | Action | Effort |
|---|---|---|
| 1 | **Revoke both exposed GitHub PATs** — check audit logs for unauthorized use | 5 min |
| 2 | **Bind Ollama to localhost** — set `OLLAMA_HOST=127.0.0.1` and restart | 2 min |
| 3 | **Bind Express to localhost** — change `app.listen(3000)` to `app.listen(3000, '127.0.0.1')` if only local machine access is needed | 2 min |
| 4 | **Remove secrets from `/api/config` response** — never return tokens/keys in API responses | 30 min |

### 🔴 Short Term (This Week)

| Priority | Action | Effort |
|---|---|---|
| 5 | **Add authentication middleware** — generate random API key at startup, require as Bearer token on all `/api/*` routes | 2-4 hrs |
| 6 | **Add helmet middleware** — `npm install helmet && app.use(helmet())` for all security headers | 30 min |
| 7 | **Add rate limiting** — `npm install express-rate-limit`, apply to all routes, stricter on `/api/chat` and `/api/launch-*` | 1 hr |
| 8 | **Configure CORS** — explicit allowlist, deny all other origins | 30 min |
| 9 | **Enable HTTPS** — use `mkcert` to generate local cert, configure Express or nginx as TLS proxy | 2 hrs |

### 🟠 Medium Term (This Month)

| Priority | Action | Effort |
|---|---|---|
| 10 | **Strip internal paths from all API responses** — use relative paths or abstract identifiers | 2-4 hrs |
| 11 | **Audit and close unknown ports** — identify services on 5000/8000, close if not needed | 1 hr |
| 12 | **Bind Archon MCP to localhost** — restrict to `127.0.0.1` | 30 min |
| 13 | **Set `NODE_ENV=production`** — prevents stack trace leakage in error responses | 5 min |
| 14 | **Disable SSH password auth** — enforce key-based authentication only | 30 min |
| 15 | **Add input validation** — `npm install express-validator`, validate all POST body parameters | 4-8 hrs |

---

## 6. Remediation Code Snippets

### Quick Win: Localhost Binding + Helmet + Rate Limiting

```javascript
// server.js / app.js additions
const helmet = require('helmet');          // npm install helmet
const rateLimit = require('express-rate-limit');  // npm install express-rate-limit
const crypto = require('crypto');

// Security headers
app.use(helmet());

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
const strictLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use('/api/', limiter);
app.use('/api/chat', strictLimiter);
app.use('/api/launch-', strictLimiter);

// Simple API key auth middleware
const API_KEY = process.env.APP_API_KEY || crypto.randomBytes(32).toString('hex');
console.log(`[STARTUP] API Key: ${API_KEY}`);
const requireAuth = (req, res, next) => {
  const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
};
app.use('/api/', requireAuth);

// Bind to localhost only
app.listen(3000, '127.0.0.1', () => console.log('Server on 127.0.0.1:3000'));
```

### Fix Ollama Exposure
```bash
# Add to ~/.zshrc or ~/.bashrc or launchd plist:
export OLLAMA_HOST=127.0.0.1
# Then restart: ollama stop && ollama serve
```

### Remove Secrets from Config Endpoint
```javascript
// In your /api/config route handler:
app.get('/api/config', requireAuth, (req, res) => {
  const config = getConfig();
  // Strip all secrets before sending
  const { githubToken, githubTokenBill, apiKeys, ...safeConfig } = config;
  res.json(safeConfig);
});
```

---

## 7. Conclusion

The **Th3rdAI Code Companion** application presents a **critical security posture** that requires immediate remediation before continued use on any shared or semi-trusted network. The combination of exposed credentials, complete absence of authentication, and unauthenticated code execution triggers creates a high-risk profile.

The good news: the majority of these issues can be resolved with **less than a day of engineering effort** using standard Node.js/Express security libraries. The application's functionality does not need to change — only its security controls need to be added.

**Most Critical Single Action:** Revoke the two exposed GitHub Personal Access Tokens immediately, as they may already have been harvested if this application has been running in its current state on a network with other users.

---

*Report generated: 2026-03-14 | Assessor: Agent Zero Security | Target: http://HOST_IP:3000/ | Scope: High-level black-box assessment*
