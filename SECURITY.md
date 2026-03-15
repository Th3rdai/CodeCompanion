# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in Code Companion, please report it responsibly.

**Email:** james@th3rdai.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We will acknowledge your report within 48 hours and aim to provide a fix or mitigation within 7 days for critical issues.

## Security Design

Code Companion is designed with privacy as a core principle:

- All AI processing runs locally via Ollama — no code is sent to external servers
- No telemetry, analytics, or tracking
- Conversation history is stored locally as JSON files
- No authentication tokens are stored unless explicitly configured by the user (e.g., GitHub PAT)
- License keys use Ed25519 offline verification — no phone-home required
