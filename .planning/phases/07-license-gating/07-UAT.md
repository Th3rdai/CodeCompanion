---
status: complete
phase: 07-license-gating
source: 07-01-SUMMARY.md
started: 2026-03-14T22:00:00Z
updated: 2026-03-15T04:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test

expected: Server boots without errors. GET /api/license returns JSON with tier, features, source fields.
result: pass

### 2. Free Modes Accessible Without License

expected: Prompting and Create are visible and clickable (no PRO badge). All other free modes accessible.
result: pass

### 3. Pro Modes Show PRO Badge When Unlicensed

expected: Skillz and Agentic mode tabs show PRO badge. Clicking either opens UpgradePrompt modal.
result: pass

### 4. UpgradePrompt Modal — Trial Start

expected: Modal shows trial button, key input, feature list. Trial start closes modal, shows toast, unlocks Skillz and Agentic.
result: pass

### 5. Licensed Mode Access After Trial

expected: Skillz and Agentic builder panels load without 403 errors.
result: pass

### 6. Settings License Tab — Status Display

expected: Shows Pro tier, Free Trial source, Enabled features, Deactivate button.
result: pass

### 7. License Deactivation

expected: Deactivate reverts to Free. PRO badges return. Auto-switches from locked mode to Chat.
result: pass

### 8. License Key Activation (Feature-Based)

expected: Feature key with --features skillz unlocks only Skillz. Agentic stays locked.
result: pass

### 9. Feature-Based Gating on API

expected: /api/score mode=skillz returns 200 with skillz key. mode=agentic returns 403 upgrade_required.
result: pass

### 10. History Conversation Lock Guard

expected: Deactivating license then clicking a Skillz conversation shows UpgradePrompt instead of loading.
result: pass

### 11. Generate License Key — Feature Validation

expected: Invalid features rejected. Valid features accepted with correct payload.
result: pass

### 12. Legacy Key Backward Compatibility

expected: Legacy tier:pro key activates with features=['skillz','agentic'] derived from FEATURE_TIERS.
result: pass

### 13. API Gating — Free mode (prompting) not blocked

expected: POST /api/score with mode=prompting returns 200 (not 403) regardless of license state.
result: pass

## Summary

total: 13
passed: 13
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
