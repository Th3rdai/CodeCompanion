---
status: testing
phase: 04-actionable-guidance
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md
started: 2026-03-14T17:50:00Z
updated: 2026-03-14T17:50:00Z
---

## Current Test

<!-- OVERWRITE each test - shows where we are -->

number: 1
name: Fix Prompt Appears in Review Findings
expected: |
Submit code for review. When the report card loads, expand any finding. Below the finding explanation, you should see a visually distinct block labeled "What to ask your AI to fix" containing a natural-language instruction (not a code snippet). The prompt should describe the fix in plain English.
awaiting: user response

## Tests

### 1. Fix Prompt Appears in Review Findings

expected: Submit code for review. When the report card loads, expand any finding. Below the finding explanation, you should see a visually distinct block labeled "What to ask your AI to fix" containing a natural-language instruction (not a code snippet). The prompt should describe the fix in plain English.
result: [pending]

### 2. Per-Finding Copy Button

expected: Each fix prompt block has a copy button (Lucide clipboard icon, not emoji). Clicking it copies the fix prompt text to your clipboard. A toast appears saying "Copied! Paste this into your AI tool to fix it." and auto-dismisses after about 3 seconds.
result: [pending]

### 3. Copy All Fix Prompts Button

expected: At the top of the report card (near the header area), there is a "Copy All Fix Prompts" button. Clicking it copies all fix prompts as a numbered list to your clipboard, sorted by severity (most critical first). Toast confirms the copy.
result: [pending]

### 4. Fix Prompt Fallback for Missing LLM Field

expected: If a finding has no LLM-generated fixPrompt (e.g., from an older or weaker model), the UI still shows a fix prompt block generated from the finding title and explanation. No empty or missing prompt blocks.
result: [pending]

### 5. Model Warning for Small Models

expected: Select a small/weak model (e.g., gemma3:1b or phi3) in the model dropdown. In Review mode, before submitting code, an amber warning appears suggesting a better model with a "Switch" button. The warning is friendly, not alarming.
result: [pending]

### 6. Model Switch Button Auto-Selects Better Model

expected: When the model warning appears and you click "Switch", the model dropdown automatically changes to the suggested better model. No manual selection needed.
result: [pending]

### 7. Post-Review Suspicion Banner

expected: Run a review with a weak model (gemma3:1b). If the results come back with suspiciously good grades (mostly A's, few findings), a gentle banner appears below the report card suggesting you try a larger model, with a "Try it" button.
result: [pending]

### 8. Review Auto-Saved to History

expected: Complete a code review. Without clicking any save button, check the sidebar history list. The review should appear automatically with a colored grade badge (e.g., green "A", blue "B") showing the overall grade.
result: [pending]

### 9. Reopen Saved Review from Sidebar

expected: Click on a saved review in the sidebar. The full report card reopens with all grades, findings, and fix prompts intact — not a blank state or chat view.
result: [pending]

### 10. Deep-Dive Conversation Persists

expected: Open a saved review, click "Learn More" on a category to start a deep-dive conversation. Ask a follow-up question. Then navigate away (click another history item or mode). Come back to the same review — the deep-dive messages should still be there.
result: [pending]

### 11. Model Warnings Only in Review Mode

expected: Select a small model (gemma3:1b). Switch to Chat, Explain, or any non-Review mode. No model capability warning should appear. Switch back to Review mode — the warning appears again.
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0

## Gaps

[none yet]
