# Plan Review: AGENTSKILL.md (Chat agent first-party app capabilities)

## Verdict: READY

## Summary

`AGENTSKILL.md` now **closes the prior Critical and Major gaps**: Review builtin **model/code** alignment with `POST /api/review`, an **explicit abort implementation path** (including current code reality in `lib/ollama-client.js` / `lib/review.js`), **default deferral of Experiment-from-Chat**, an **enumerated pentest surface** for agent phases, **non-flaky builder test acceptance**, and **shared-service extraction** (no “call the Express route from a builtin”). The plan is **suitable to implement** in the phased order given; remaining risk is normal engineering execution (wiring + tests), not unspecified product ambiguity.

## Issues Found

### Critical

_None remaining._ Prior items (model/code contract, abort propagation) are resolved in `AGENTSKILL.md` §5.1 / §11.

### Major

_None remaining._ Prior items (Experiment default, pentest enumeration, score tests, service extraction) are resolved in §5.2 / §5.3 / §11.

### Minor

- **HTTP review stream fallback:** `POST /api/review` can still stream when structured output fails; a Chat **builtin** will likely return **synchronous JSON only**. The plan should allow either **blocking until stream end** and then summarizing, or **documenting “structured path only”** for v1. Recommend adding one sentence to Phase 1 when implementing (not a plan blocker).

## Improvements Suggested

- When implementing Phase 1, add **one integration test** that passes `AbortSignal` and asserts fetch/Ollama is aborted quickly (mock server or stub `chatStructured`).
- Keep the **skill matrix** (§11 in plan) updated as each phase ships.

## Verification Checklist

- [x] Referenced core files exist and were spot-checked for abort behavior (`lib/review.js`, `lib/ollama-client.js` `chatStructured` / `chatStream`).
- [x] Plan documents **model + code** parity with `routes/review.js` (`POST /api/review`).
- [x] Plan documents **abort gap** and required `chatStructured` + `reviewCode` threading.
- [x] Pentest routes enumerated: `/pentest`, `/pentest/remediate`, `/pentest/folder/preview`, `/pentest/folder`.
- [x] Experiment-from-Chat **deferred by default** for v1.
- [x] Builder acceptance avoids flaky LLM equality.
- [x] Shared implementation = **lib service** consumed by route + builtin, not Express self-calls.

## Self-check (Phase 5 of plan-reviewer skill)

1. An implementer can start Phase 0 without unresolved §9 blockers.
2. Issues above are either cleared or downgraded to Minor with a concrete follow-up.
3. **READY** is justified: decisions are written into the plan body.
4. Residual Minor item is optional polish for Phase 1 streaming parity.

---

| Date       | Change                                                                                                                                                                                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-01 | Initial review — NEEDS REVISION                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-01 | Re-review after plan updates — **READY**                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-01 | Final pass post-v1.6.32: verified all file/function references against current code; confirmed `chatStructured` abort gap is real (line 238); 3 minor polish items (result envelope, error envelope, experiment-mode interaction, audit log destination, abort test elevation, Phase 0.5 sequencing) folded into the plan body. **Verdict: READY** — no remaining blockers. |
