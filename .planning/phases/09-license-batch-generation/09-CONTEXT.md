# Phase 9: License Batch Generation — Context

**Status:** Planned
**Depends on:** Phase 7 (License Gating)

## Phase Boundary

Extend the license key generator to support bulk generation for hundreds or thousands of keys. Extract shared signing logic into a reusable module so both CLI and future webhook/API can use it.

## Existing Assets

- `scripts/generate-license-key.js` — Single-key CLI; Ed25519 signing
- `lib/license-manager.js` — Validation, FEATURE_TIERS, public key
- Private key at `scripts/.license-private-key` (gitignored)

## Scope

- Extract `generateKey({ email, features, expires })` into `lib/license-generator.js`
- Add `--batch` mode to CLI: read CSV/JSON, output keys
- Progress logging, error handling for invalid rows

## Out of Scope

- Payment integration (Phase 10)
- Email delivery (Phase 13)
- Revocation (Phase 14)
