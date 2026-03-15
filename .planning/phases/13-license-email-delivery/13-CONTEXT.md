# Phase 13: License Email Delivery — Context

**Status:** Planned
**Depends on:** Phase 9 (standalone) or Phase 10 (integration)

## Phase Boundary

Reliable email delivery for generated license keys. Provider-agnostic module with template support.

## Scope

- Email sender module (SendGrid, Resend, or SMTP)
- HTML template for license email
- Config for provider, API key, from address
- Retry and error logging

## Out of Scope

- Payment flow (Phase 10)
- Transactional email for other purposes (future)
