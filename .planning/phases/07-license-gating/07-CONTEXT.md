# Phase 7: License Gating — Context

**Gathered:** 2026-03-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up the existing license infrastructure so that the v2.0 builder modes (Prompting, Skillz, Agentic) and Create mode are gated by license. Extend the license model from a single tier (free/pro) to a **feature-based model** so each builder mode can be licensed independently. Users without a license see upgrade prompts; users with a valid license or trial see the full feature set.

**Existing assets:**

- `lib/license-manager.js` — FEATURE_TIERS registry, isFeatureAllowed(), getLicenseInfo(), Ed25519 validation
- `lib/license-middleware.js` — requireTier(), requireTierForMode
- `scripts/generate-license-key.js` — Key generation (currently tier-only payload)
- FEATURE_TIERS already defines mode:prompting, mode:skillz, mode:agentic, mode:create as 'pro'

**Already wired (as of 2026-03-15):**

- initLicense() called in server.js
- /api/license, /api/license/activate, /api/license/deactivate, /api/license/trial exist
- /api/chat, /api/score, /api/create-project protected by requireTierForMode or requireTier
- App.jsx: licenseInfo, fetchLicense, isModeLocked, showUpgrade modal, locked mode buttons
- SettingsPanel: License section with activate, trial, deactivate, onLicenseChange→fetchLicense
- src/constants/tiers.js: MODE_TIERS, isModeLocked(modeId, tier)

**Remaining for Phase 7:**

- Extend license model from tier-only to feature-based (independent Prompting/Skillz/Agentic)
- validateKey: accept features array in payload; generate-license-key: --features flag
- Frontend isModeLocked: support licenseInfo.features (check features.includes(modeId))
- lastMode fallback when restored mode is locked (must run AFTER license fetch — G7 race fix)
- Builder panel /api/score 403 handling (show upgrade when deactivated mid-session)
- create-mode E2E: activate trial in beforeEach so tests pass (G11)
  </domain>

<decisions>
## Implementation Decisions

### Feature-Based License Model (2026-03-15)

- **Primary model:** `license.features` array — e.g. `['prompting','skillz','agentic','create']`
- **Backward compatibility:** Legacy keys with `tier: 'pro'` (no features array) → treat as all pro features enabled
- **isFeatureAllowed(featureId):** If `features` exists, check `features.includes(featureId.replace('mode:',''))`. Else if `tier === 'pro'`, allow all. Else deny.
- **Independent licensing:** Each of Prompting, Skillz, Agentic can be sold separately. "Pro bundle" = all features.

### License Key Payload Extension

- **Current:** `{ email, tier, exp, nonce }`
- **Extended:** `{ email, tier?, features?, exp, nonce }`
- **generate-license-key.js:** Add `--features prompting,skillz,agentic` flag. If absent, use `tier: pro` (legacy).
- **Validation:** If payload has `features` array, use it. Else if `tier === 'pro'`, derive features from FEATURE_TIERS (all pro features).

### Server Wiring

- **initLicense()** — Call after initConfig() in server.js
- **POST /api/score** — Apply requireTierForMode or per-mode requireTier. Block with 403 + upgrade_required if not allowed.
- **POST /api/create-project** — Apply requireTier('mode:create')
- **GET /api/license** — New endpoint returning safe license info: `{ tier, features, trialDaysLeft, trialAvailable, expiresAt }` (no key)
- **sanitizeConfigForClient** — Include license summary in /api/config response, or keep separate /api/license

### Frontend Wiring

- **Fetch license on load** — GET /api/license (or from /api/config)
- **Filter MODES** — Only show modes where isFeatureAllowed would return true. Compute visible modes from license.features or tier.
- **Locked state** — Optional: show builder mode buttons as disabled/locked with "Upgrade" tooltip when not licensed
- **License UI in Settings** — Section for: Enter license key, Start trial, View current license (tier, features, expiry). Deactivate button.

### Trial Behavior

- **startTrial()** — Grant all pro features for 14 days. Persist trialStartedAt. No change to feature model.
- **Trial UX** — "Start 14-day trial" button in Settings when trialAvailable and no license. Trial grants full access.
  </decisions>

<interfaces>
## Key Integration Points

**lib/license-manager.js**

- initLicense() — Must be called after getConfig() is available
- isFeatureAllowed('mode:prompting') — Returns boolean
- getLicenseInfo() — Returns { tier, features?, source, expiresAt, trialDaysLeft, trialAvailable }
- activateLicense(key), startTrial(), deactivateLicense()

**server.js** (already wired)

- initLicense() at line ~116
- GET /api/license, POST /api/license/activate, /deactivate, /trial at lines ~212-236
- requireTierForMode on /api/chat (268), /api/score (604)
- requireTier('mode:create') on /api/create-project (921)

**src/App.jsx** (already wired)

- licenseInfo, fetchLicense, isModeLocked, showUpgrade, UpgradePrompt modal
- Mode tabs — locked modes show PRO badge, click shows UpgradePrompt
- loadConversation — needs locked-mode check (Task 7)
- lastMode restore — needs fallback when locked (Task 4)

**src/constants/tiers.js**

- MODE_TIERS, isModeLocked(modeId, tier) — extend to accept licenseInfo with features
  </interfaces>
