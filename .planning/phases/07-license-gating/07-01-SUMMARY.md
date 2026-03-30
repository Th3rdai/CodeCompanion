---
phase: 07-license-gating
plan: 01
status: complete
completed: 2026-03-14
---

# Phase 7, Plan 01 — Feature-Based License Gating

## What Was Done

Extended the existing tier-only license system to a feature-based model supporting independent mode licensing. Skillz and Agentic are pro-gated; Prompting and Create remain free.

### Backend (lib/license-manager.js)

- Added `features` array to `_licenseState` and all persistence paths
- Added `_getProFeatures()` helper deriving pro features from `FEATURE_TIERS` registry
- Fixed `validateKey()` to accept `{ features: [...] }` payloads (not just `{ tier }`)
- Synthesizes `tier: 'pro'` for feature-based keys (backward-compatible)
- Updated `isFeatureAllowed()` with `features !== undefined` semantics — empty `[]` denies all pro features
- Updated `getLicenseInfo()` to return features array
- Updated `_persistLicense()` to save features to config
- Updated `activateLicense()`, `startTrial()`, `handleAppStorePurchase()`, `deactivateLicense()` to manage features
- Added explicit `features = []` clearing in trial-expired and key-invalid paths
- Exported `getEnabledFeatures()` helper

### Key Generator (scripts/generate-license-key.js)

- Added `--features` CLI flag (comma-separated, e.g., `--features skillz,agentic`)
- Feature validation against known list: prompting, skillz, agentic, create
- Features payload takes precedence over `--tier` when both provided
- Updated help text with examples

### Frontend (src/constants/tiers.js, src/App.jsx)

- `isModeLocked(modeId, licenseInfo)` now accepts full licenseInfo object, checks `features.includes(modeId)` then `tier` fallback
- Mode-lock safety `useEffect` resets to chat when current mode becomes locked
- Handles Electron lastMode restore race condition (useEffect catches stale mode after license loads)
- `loadConversation()` guard prevents loading history conversations in locked modes

### Settings (src/components/SettingsPanel.jsx)

- Shows enabled features list in license status display

### Server (server.js)

- Added `features` to `sanitizeConfigForClient()` for `/api/config` consistency

## Verification Results

- Feature-based key (skillz only): skillz=allowed, agentic=denied, prompting=allowed (free)
- Legacy key (tier:pro): all pro features granted via `_getProFeatures()`
- Trial: grants all pro features, 14 days
- Deactivate: clears all features
- Invalid feature names rejected by key generator
- All 27 UI tests pass, 4 E2E tests pass, 16 unit tests pass
- Build clean (dist/ produced, no errors)

## Files Modified

- `lib/license-manager.js` — feature-based model core
- `scripts/generate-license-key.js` — `--features` flag
- `src/constants/tiers.js` — `isModeLocked` signature change
- `src/App.jsx` — mode-lock safety, loadConversation guard
- `src/components/SettingsPanel.jsx` — features display
- `server.js` — sanitizeConfigForClient features
