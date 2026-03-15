# Phase 11: License Server API — Context

**Status:** Planned
**Depends on:** Phase 10 (for license_keys storage) or Phase 9 (minimal)

## Phase Boundary

Add API endpoints for online license validation and optional revocation. Enables per-installation checks and admin revocation.

## Scope

- `POST /api/license/validate` — validate key, return features/expires
- `POST /api/admin/license/revoke` — revoke key (admin auth)
- Optional: app-side config for online vs offline validation

## Out of Scope

- Full admin UI (CLI or manual API calls sufficient initially)
- Key pool / claim flow (Phase 12)
