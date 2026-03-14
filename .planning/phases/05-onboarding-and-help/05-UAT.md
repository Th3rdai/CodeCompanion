---
status: paused
phase: 05-onboarding-and-help
source: 05-01-SUMMARY.md, 05-02-SUMMARY.md
started: 2026-03-14T21:45:00Z
updated: 2026-03-14T22:00:00Z
---

## Current Test

number: 2
name: Onboarding Vibe-Coder Language
expected: |
  Open onboarding wizard (clear localStorage first). All steps use friendly, non-technical language. References "AI coding tool" or "vibe coder" context. No mentions of "Product Managers" or corporate jargon.
awaiting: user response

## Tests

### 1. First-time Onboarding Wizard
expected: Clear localStorage (`localStorage.removeItem('th3rdai_onboarding_complete')` in DevTools Console), refresh browser. 4-step onboarding wizard appears. Step 1 says "translates AI-generated code" (not "Product Managers"). Step 2 has Ollama troubleshooting section with 3 bullet points. Step 3 shows mode grid with professional SVG icons (not emoji). Step 4 shows privacy messaging. Complete wizard → refresh → wizard does NOT reappear.
result: pass

### 2. Onboarding Vibe-Coder Language
expected: Open onboarding wizard (clear localStorage first). All steps use friendly, non-technical language. References "AI coding tool" or "vibe coder" context. No mentions of "Product Managers" or corporate jargon.
result: [pending]

### 3. Ollama Troubleshooting Guidance
expected: Open onboarding Step 2 (Connect to Ollama). Below the setup instructions, see troubleshooting section with 3 common issues: port not responding, no models installed, connection refused. Each has a plain-English fix.
result: [pending]

### 4. Mode Grid Lucide Icons
expected: Open onboarding Step 3 (Pick Your Mode). Mode grid shows 8 modes (Explain, Check for Bugs, Refactor, etc.). Each mode has a professional SVG icon (not emoji). Icons render cleanly at proper size.
result: [pending]

### 5. Privacy Messaging Visibility
expected: Open onboarding Step 4 OR scroll to bottom of app. Privacy banner shows 4 assurances: "Your code stays on your machine", "nothing sent to cloud", "AI runs locally through Ollama", "No tracking, no accounts". Message is clear without hunting for it.
result: [pending]

### 6. Privacy Banner Dismissal
expected: See privacy banner at bottom of app. Click "Got it" button. Banner disappears. Refresh browser. Banner does NOT reappear (localStorage persists dismissal).
result: [pending]

### 7. Jargon Glossary Definitions
expected: Click glossary icon in toolbar (book icon). Glossary panel opens. Search for terms like "API", "Cache", "Component". Each definition uses plain-English analogy ("Think of it like..." or "Like a..."). Zero unexplained technical jargon.
result: [pending]

### 8. Glossary Search and Filter
expected: Open glossary panel. Type "api" in search box → shows matching terms. Click category filter button (e.g., "Security") → shows only security terms. Search and filters work smoothly.
result: [pending]

## Summary

total: 8
passed: 1
issues: 0
pending: 7
skipped: 0

## Gaps

[none yet]
