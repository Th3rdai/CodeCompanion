<p align="center">
  <img src="resources/th3rdai-logo-sm.png" alt="Th3rdAI" width="150" />
</p>

# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in **Code Companion**, please report it **privately** so it can be fixed before public disclosure.

### How to report (choose one)

1. **Email (always available)**  
   **james@th3rdai.com**

2. **GitHub** (if you have a GitHub account and the button is enabled for the repo)  
   Open the repository’s **Security** tab and use **Report a vulnerability** / private security advisory:  
   **[github.com/th3rdai/CodeCompanion/security](https://github.com/th3rdai/CodeCompanion/security)**  

   If private reporting is not enabled or the link does not apply to your fork, use email instead.

### What to include

- Description of the issue and affected component (e.g. `server.js`, Electron, MCP)
- Steps to reproduce (or proof-of-concept), if safe to share
- Your assessment of impact (confidentiality / integrity / availability)

### What to expect

- **Acknowledgment:** We aim to reply within **48 hours** of a valid report.
- **Critical issues:** We aim to provide a fix or documented mitigation within **7 days** where feasible; timing depends on severity and complexity.
- **Coordination:** We may ask follow-up questions; please allow time for a coordinated release before public disclosure.

We appreciate responsible disclosure.

### Deployment and configuration

The HTTP server **defaults to `127.0.0.1`** (localhost-only). Use **`CC_BIND_ALL=1`** or **`HOST=0.0.0.0`** only when you intentionally need LAN access; pair with firewall rules as appropriate. Sensitive mutations (Settings save, GitHub token, file save, MCP management, logs) accept requests from **loopback** or from any client that sends **`X-CC-API-Key`** matching **`CC_API_SECRET`** (if set). See **[docs/ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md)** and the static assessment **[docs/PENTEST-REPORT-CodeCompanion-Static-Analysis.md](docs/PENTEST-REPORT-CodeCompanion-Static-Analysis.md)**.

### Headers, API errors, and dependencies (2026-03+)

- **CSP:** Production **`script-src`** uses **`'self'`** plus a **per-response nonce** (no **`unsafe-inline`** for scripts). The shell HTML is served from `server.js` so script tags match the nonce. See **[docs/SECURITY-OPERATIONS.md](docs/SECURITY-OPERATIONS.md)**.
- **5xx responses:** JSON and SSE error payloads use generic messages from **`lib/client-errors.js`**; full details are written to server logs only.
- **Supply chain:** CI runs **`npm audit --audit-level=critical`** (see **`.github/workflows/ci.yml`**). Locally, run **`npm audit`** / **`npm run audit:security`** for the full report.

## Security Design

Code Companion is designed with privacy as a core principle:

- AI inference is intended to run **locally** via Ollama — no requirement to send code to cloud LLMs
- No telemetry, analytics, or tracking from the app itself
- Conversation history is stored locally as JSON files
- Authentication tokens (e.g. GitHub PAT) are only stored when **you** configure them; they are not included in API responses to the client in full form (see server sanitization of config)
- License verification uses offline Ed25519 checks — no license phone-home

**Threat model:** The app is a **single-user, local** tool. If you bind the server to all interfaces or expose ports, treat it like any local dev server: restrict network access as appropriate for your environment. Prefer opening the UI at **`http://127.0.0.1:PORT`** or **`http://localhost:PORT`** so browser requests to protected APIs originate from loopback; or configure **`CC_API_SECRET`** and send the header from trusted clients.
