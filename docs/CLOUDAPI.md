# CLOUDAPI.md

## Multi-Provider Execution Checklist

| Done | Phase | Task ID | Owner | Task                                                                                                                        | Dependencies | Evidence                         |
| ---- | ----- | ------- | ----- | --------------------------------------------------------------------------------------------------------------------------- | ------------ | -------------------------------- |
| [ ]  | P0    | P0-01   | BE    | Confirm locked decisions (default provider, HF endpoint, qualified model IDs, capability flags) in kickoff note             | None         | Kickoff note linked              |
| [ ]  | P0    | P0-02   | BE    | Define provider-neutral error categories (`auth`, `rate_limit`, `timeout`, `upstream_unavailable`, `validation`, `unknown`) | P0-01        | Type/constants committed         |
| [ ]  | P0    | P0-03   | QA    | Capture Ollama baseline metrics (hard-block, stream stall, stop/cancel)                                                     | P0-01        | Baseline report                  |
| [ ]  | P0    | P0-04   | QA    | Verify current tests pass before changes                                                                                    | None         | CI/local test run attached       |
| [ ]  | P0    | P0-05   | BE    | Specify model ID parser rule: split on first `:`; preserve legacy Ollama tags unless known provider prefix                  | P0-01        | Parser spec note + tests planned |

| Done | Phase | Task ID | Owner | Task                                                                                                                                             | Dependencies | Evidence                      |
| ---- | ----- | ------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ----------------------------- |
| [ ]  | P1    | P1-01   | BE    | Create `lib/model-client/index.js` interface (`listModels`, `checkConnection`, `chatStream`, `chatComplete`, `chatStructured`, `normalizeError`) | P0-02        | File added                    |
| [ ]  | P1    | P1-02   | BE    | Create `lib/model-client/router.js` dispatching by `provider:modelId` + capability flags                                                         | P1-01, P0-05 | File added + unit tests       |
| [ ]  | P1    | P1-03   | BE    | Add `lib/model-client/providers/ollama.js` by moving current Ollama behavior                                                                     | P1-01        | File added + parity tests     |
| [ ]  | P1    | BE      | P1-04 | Swap `lib/chat-post-handler.js` to router calls while preserving SSE contract                                                                    | P1-02, P1-03 | Diff + chat smoke test        |
| [ ]  | P1    | P1-05   | BE    | Swap `server.js` model/list/check routes to router-backed calls                                                                                  | P1-02, P1-03 | Route tests pass              |
| [ ]  | P1    | P1-06   | QA    | Ollama regression pass (chat, stream, stop/cancel, tool loop)                                                                                    | P1-04, P1-05 | Regression checklist complete |
| [ ]  | P1    | GATE-P1 | QA    | Phase gate: zero Ollama behavior regressions                                                                                                     | P1-06        | Gate signed off               |

| Done | Phase | Task ID | Owner | Task                                                                                                            | Dependencies        | Evidence               |
| ---- | ----- | ------- | ----- | --------------------------------------------------------------------------------------------------------------- | ------------------- | ---------------------- |
| [ ]  | P2    | P2-01   | BE    | Update `lib/config.js` schema: `modelProvider`, nested `providers.*`, capability flags                          | P1 gate             | Config tests           |
| [ ]  | P2    | P2-02   | BE    | Implement config migration (`ollamaUrl`/`ollamaApiKey` -> `providers.ollama`)                                   | P2-01               | Migration tests        |
| [ ]  | P2    | P2-03   | BE    | Enforce save semantics: no accidental key clearing unless explicit clear                                        | P2-01               | Save/load tests        |
| [ ]  | P2    | P2-04   | FE    | Update `src/components/panels/SettingsPanel.jsx` with provider selector + per-provider key fields + test/fetch actions | P2-01               | UI screenshots         |
| [ ]  | P2    | FE      | P2-05 | Wire settings state/load/save flow for provider config                                                          | P2-01, P2-04        | Manual flow verified   |
| [ ]  | P2    | QA      | P2-06 | Verify no secret leakage in API responses/logs                                                                  | P2-01..P2-05        | Redaction test results |
| [ ]  | P2    | GATE-P2 | QA    | Phase gate: legacy config deterministic, settings stable                                                        | P2-02, P2-03, P2-06 | Gate signed off        |

| Done | Phase | Task ID | Owner | Task                                                                             | Dependencies | Evidence            |
| ---- | ----- | ------- | ----- | -------------------------------------------------------------------------------- | ------------ | ------------------- |
| [ ]  | P3    | P3-01   | BE    | Add `providers/openai.js` adapter (stream/complete/structured + error normalize) | P2 gate      | Adapter tests       |
| [ ]  | P3    | P3-02   | BE    | Add `providers/openrouter.js` adapter with `HTTP-Referer` and `X-Title` support  | P2 gate      | Adapter tests       |
| [ ]  | P3    | P3-03   | BE    | Model listing normalization for OpenAI/OpenRouter                                | P3-01, P3-02 | Listing tests       |
| [ ]  | P3    | QA      | P3-04 | Validate stop/cancel and stream reliability for OpenAI/OpenRouter                | P3-01..P3-03 | Integration results |
| [ ]  | P3    | GATE-P3 | QA    | Phase gate: OpenAI/OpenRouter stable                                             | P3-04        | Gate signed off     |

| Done | Phase | Task ID | Owner | Task                                                                   | Dependencies | Evidence          |
| ---- | ----- | ------- | ----- | ---------------------------------------------------------------------- | ------------ | ----------------- |
| [ ]  | P4    | P4-01   | BE    | Add `providers/anthropic.js` adapter                                   | P3 gate      | Adapter tests     |
| [ ]  | P4    | P4-02   | BE    | Add `providers/google.js` adapter                                      | P3 gate      | Adapter tests     |
| [ ]  | P4    | P4-03   | BE    | Normalize provider-specific stream/error behavior for Anthropic/Google | P4-01, P4-02 | Integration tests |
| [ ]  | P4    | QA      | P4-04 | Validate vision flows where model supports vision                      | P4-01..P4-03 | Vision QA report  |
| [ ]  | P4    | GATE-P4 | QA    | Phase gate: Anthropic/Google stable                                    | P4-03, P4-04 | Gate signed off   |

| Done | Phase | Task ID | Owner | Task                                                                             | Dependencies | Evidence        |
| ---- | ----- | ------- | ----- | -------------------------------------------------------------------------------- | ------------ | --------------- |
| [ ]  | P5    | P5-01   | BE    | Add `providers/huggingface.js` using locked HF Router OpenAI-compatible endpoint | P4 gate      | Adapter tests   |
| [ ]  | P5    | BE      | P5-02 | Enforce deterministic HF model routing + capability gating                       | P5-01, P0-05 | Routing tests   |
| [ ]  | P5    | QA      | P5-03 | Validate unsupported-feature messaging and fallback behavior                     | P5-01, P5-02 | QA evidence     |
| [ ]  | P5    | GATE-P5 | QA    | Phase gate: HF endpoint stable, no ambiguity                                     | P5-03        | Gate signed off |

| Done | Phase | Task ID | Owner | Task                                                                                                | Dependencies | Evidence             |
| ---- | ----- | ------- | ----- | --------------------------------------------------------------------------------------------------- | ------------ | -------------------- |
| [ ]  | P6    | P6-01   | BE    | Update `lib/auto-model.js` for multi-provider inventory + provider-aware fallback                   | P5 gate      | Unit tests           |
| [ ]  | P6    | BE      | P6-02 | Integrate provider/model reliability telemetry into fallback logic                                  | P6-01        | Telemetry assertions |
| [ ]  | P6    | QA      | P6-03 | Validate Recover Agent behavior across providers                                                    | P6-01, P6-02 | End-to-end captures  |
| [ ]  | P6    | QA      | P6-04 | Run release-threshold evaluation window (>=500 provider-routed turns/provider in staging or replay) | P6-03        | Metrics report       |
| [ ]  | P6    | GATE-P6 | QA    | Phase gate: thresholds passed for provider default-enable decision                                  | P6-04        | Go/No-Go record      |

| Done | Phase | Task ID | Owner   | Task                                                    | Dependencies | Evidence          |
| ---- | ----- | ------- | ------- | ------------------------------------------------------- | ------------ | ----------------- |
| [ ]  | P7    | P7-01   | BE      | Final docs update (settings, env vars, troubleshooting) | P6 gate      | Docs PR           |
| [ ]  | P7    | P7-02   | QA      | Final regression suite (Ollama + all enabled providers) | P7-01        | Full test report  |
| [ ]  | P7    | P7-03   | Release | Enable providers by capability flag per gate outcomes   | P7-02        | Release checklist |

## Release Thresholds (Required for default-enable)

| Done | Metric                              | Threshold                                       | Owner | Evidence                     |
| ---- | ----------------------------------- | ----------------------------------------------- | ----- | ---------------------------- |
| [ ]  | Hard-block delta vs Ollama baseline | <= +1.0 percentage point per provider           | QA    | Metrics report               |
| [ ]  | Streaming stall delta vs baseline   | <= +0.5 percentage points                       | QA    | Metrics report               |
| [ ]  | Stop/cancel success                 | >= 99% for provider-enabled chats               | QA    | Integration + staging report |
| [ ]  | Secret redaction                    | 100% pass on logging/error serialization checks | QA    | Security test output         |

## Rollback Checklist

| Done | Trigger                       | Action                                                              | Owner       | Evidence              |
| ---- | ----------------------------- | ------------------------------------------------------------------- | ----------- | --------------------- |
| [ ]  | Hard-block threshold exceeded | Disable affected provider capability flag                           | BE/Release  | Config change record  |
| [ ]  | Streaming stalls regress      | Disable affected provider, keep router+Ollama active                | BE/Release  | Incident note         |
| [ ]  | Secret leakage risk           | Disable cloud providers immediately, ship fix, rotate impacted keys | Security/BE | Security response log |

## Final Readiness Checklist

| Done | Check                                                                                                                                                                   | Owner   | Evidence          |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------- |
| [ ]  | Referenced files and routes verified present (`lib/chat-post-handler.js`, `lib/auto-model.js`, `server.js`, `src/components/panels/SettingsPanel.jsx`, `lib/ollama-client.js`) | BE      | Verification note |
| [ ]  | Dependency order followed with all phase gates signed                                                                                                                   | QA      | Gate records      |
| [ ]  | Tests added and passing (unit + integration + manual QA)                                                                                                                | QA      | Test reports      |
| [ ]  | Ollama parity maintained                                                                                                                                                | QA      | Regression report |
| [ ]  | Docs complete and accurate                                                                                                                                              | BE/Docs | Docs review       |
