# License Distribution — Phase Index

Quick reference for license key generation and distribution phases (9–14).

| Phase | Name | When to Use |
|-------|------|-------------|
| **9** | Batch Generation | Hundreds/thousands of keys; extract shared generator |
| **10** | Payment Webhook | Auto-generate on Stripe/Paddle purchase |
| **11** | License Server API | Online validation, revocation |
| **12** | Key Pool | Pre-generated keys for campaigns |
| **13** | Email Delivery | Send keys via email |
| **14** | Revocation | Revoke keys (chargebacks, abuse) |

## Execution Order

1. **9** → Batch + lib/license-generator.js (foundation)
2. **13** → Email (needed for delivery)
3. **10** → Webhook (when adding payments)
4. **11** → Server API (validation/revocation)
5. **14** → Revocation (when revoking needed)
6. **12** → Key Pool (optional)

## Dependencies

```
7 (License Gating) ─┬─► 9 (Batch)
                    │
9 ──────────────────┼─► 10 (Webhook) ─► 11 (API) ─► 14 (Revocation)
                    ├─► 12 (Pool)
                    └─► 13 (Email)
```
