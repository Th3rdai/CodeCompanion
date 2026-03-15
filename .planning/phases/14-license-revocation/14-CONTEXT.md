# Phase 14: License Revocation — Context

**Status:** Planned
**Depends on:** Phase 10 or 11 (license storage)

## Phase Boundary

Revoke license keys (chargebacks, abuse, refunds). Validation API checks revocation before returning valid. Admin CLI or API to revoke.

## Scope

- Revocation storage (key_hash or key_id)
- Validation checks revocation
- Admin revoke (CLI or API)
- Audit log

## Out of Scope

- Automatic revocation on refund (could be Phase 10 webhook extension)
- Per-feature revocation (revoke entire key only)
