# Phase 10: License Payment Webhook — Context

**Status:** Planned
**Depends on:** Phase 9 (Batch Generation — for lib/license-generator.js)

## Phase Boundary

Automatically generate and deliver license keys when a customer completes a purchase via Stripe or Paddle. Webhook receives purchase event, generates key, stores in DB, sends via email.

## Prerequisites

- Stripe or Paddle account
- Email provider (SendGrid, Resend, Postmark)
- Database for license_keys table (or JSON file for minimal setup)

## Scope

- Webhook endpoint for payment provider
- Key generation on purchase completion
- Email delivery (or Phase 13 integration)
- Idempotency by order_id

## Out of Scope

- License server validation API (Phase 11)
- Revocation (Phase 14)
