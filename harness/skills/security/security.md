---
name: security
description: "OWASP-style security assessment and pentest scanning. Use when checking code for vulnerabilities, security issues, and OWASP Top 10 compliance."
---

# Skill: Security Assessment

## Purpose

Perform OWASP-style security scans on code to identify vulnerabilities, security weaknesses, and compliance gaps.

## When to Apply

- User selects Security mode in the desktop app
- User asks for a security scan or pentest
- User wants to check for OWASP Top 10 issues
- Folder-level security scan of a project

## Inputs

- Source code (inline or file path or folder path)
- Optional: model override (defaults to 'auto')
- Optional: specific security focus (injection, XSS, auth, etc.)

## Outputs

- Security findings with severity ratings (Critical/High/Medium/Low)
- OWASP Top 10 category mapping
- Specific code locations (file:line)
- Remediation recommendations

## Procedure

1. **Receive code** — Accept inline code, file path, or folder path
2. **Determine scope** — Single file (`pentest_scan`) vs folder (`pentest_scan_folder`)
3. **Select model** — Use 'auto' or a specific Ollama model
4. **Run scan** — Call `builtin.pentest_scan` or `builtin.pentest_scan_folder`
5. **Format output** — Present findings grouped by severity
6. **Surface criticals** — Critical findings at the top with remediation steps

## Tool Binding

- `builtin.pentest_scan` — Single-file security scan
- `builtin.pentest_scan_folder` — Folder-level security scan
- `builtin.read_file` — For reading source files

## Evaluation Criteria

- Critical findings must include remediation steps
- Findings must map to OWASP Top 10 categories
- Severity ratings must be consistent for the same input + model
- No false positives from framework boilerplate (e.g., Express CSRF middleware)
