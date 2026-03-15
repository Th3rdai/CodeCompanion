# Phase 12: License Key Pool — Context

**Status:** Planned
**Depends on:** Phase 9

## Phase Boundary

Generate a pool of pre-created keys (no email) for manual or semi-automated distribution. Optional claim API assigns a key to a customer after payment.

## Use Case

- Generate 10,000 keys in advance for a campaign
- Claim API: payment completes → assign next unclaimed key to customer email
- Alternative to webhook-generated keys when you want keys ready ahead of time

## Scope

- `--pool N` mode in generate-license-key.js
- Storage for unclaimed/claimed keys
- Optional claim endpoint

## Out of Scope

- Primary distribution (Phase 10 webhook is preferred for most cases)
