# Quality Findings

**Analysis Date:** 2026-03-14

Evidence-driven quality assessment for Code Companion, with focus on test coverage, linting/type safety, maintainability, and builder modes workstream.

---

## Prioritized Quality Findings (8–12)

### 1. Builder modes have zero test coverage — HIGH
- **Evidence:** No `builder`, `prompting`, `skillz`, or `agentic` matches in `tests/`. `POST /api/score`, `lib/builder-score.js`, `lib/builder-schemas.js`, `BaseBuilderPanel.jsx` (615 lines) untested.
- **Files:** `src/components/builders/*`, `lib/builder-score.js`, `lib/builder-schemas.js`, `server.js` lines 555–600
- **Impact:** Regressions in scoring, form validation, or API contract go unnoticed. Roadmap builder workstream is fragile.
- **Action:** Add unit tests for `scoreContent`, schema validation; add E2E for Prompting mode with mocked `/api/score`.

### 2. No ESLint or Prettier — MEDIUM
- **Evidence:** No `.eslintrc*`, `.prettierrc*`, `eslint.config.*`, or `biome.json`. No lint/format scripts in `package.json`.
- **Impact:** Style drift, unused vars, potential bugs (e.g., `==` vs `===`) go undetected. No automated consistency.
- **Action:** Add ESLint + Prettier (or Biome) with minimal config; add `lint` and `format` scripts; consider pre-commit hook.

### 3. No TypeScript or JSDoc types — MEDIUM
- **Evidence:** Entire codebase is `.js`/`.jsx`. No `tsconfig.json`. Zod used only for runtime validation in `lib/builder-schemas.js`, `lib/review.js`.
- **Impact:** Refactors are error-prone. No IDE autocomplete or compile-time checks for API contracts.
- **Action:** Add JSDoc `@param`/`@returns` for public APIs; consider incremental TypeScript for `lib/` modules.

### 4. Duplicate `mockReportCardResponse` in three test files — LOW
- **Evidence:** `tests/ui/loading-animation.spec.js`, `tests/ui/report-card-interactions.spec.js`, `tests/e2e/review-workflow.spec.js` each define similar mock with slight variations.
- **Impact:** Schema changes require updates in three places. Risk of divergence.
- **Action:** Extract to `tests/fixtures/review-mocks.js` and import.

### 5. Fragmented test layout — LOW
- **Evidence:** Unit tests in `tests/*.test.js` and `tests/test/unit/`. E2E in `tests/e2e/` and `tests/test/e2e/`. No single source of truth.
- **Impact:** New contributors may add tests in wrong location. `npm run test` runs all Playwright; unit tests require `node tests/rate-limit.test.js` etc.
- **Action:** Consolidate: `tests/unit/`, `tests/ui/`, `tests/e2e/`. Add `test:unit` script to run all node:test files.

### 6. Large monolithic components — MEDIUM
- **Evidence:** `ReviewPanel.jsx` (825 lines), `App.jsx` (770 lines), `BaseBuilderPanel.jsx` (615 lines), `GitHubPanel.jsx` (811 lines).
- **Impact:** Hard to maintain and test. Changes ripple. No isolation tests for sub-behaviors.
- **Action:** Extract subcomponents (e.g., `TagInput` from BaseBuilderPanel); consider splitting ReviewPanel by input method.

### 7. Silent error handling — MEDIUM
- **Evidence:** Empty catch blocks in `src/App.jsx`, `GitHubPanel.jsx`, `FileBrowser.jsx`, `SettingsPanel.jsx`, `Effects3DContext.jsx`. CONCERNS.md documents 10+ instances.
- **Impact:** Failed API calls, file ops, config updates fail silently. No user feedback or logs.
- **Action:** Replace empty catches with `log('ERROR', ...)` and toast notifications.

### 8. Playwright CT config unused — LOW
- **Evidence:** `playwright-ct.config.js` and `@playwright/experimental-ct-react` installed. `npm run test` uses `playwright.config.js` only. No `test:ct` script.
- **Impact:** UI tests run as full E2E (slower). Component-level isolation not available.
- **Action:** Either add `test:ct` and migrate suitable UI tests to CT, or remove CT dependency to reduce confusion.

### 9. Builder mode bugs (save title, download filename) — HIGH
- **Evidence:** CONCERNS.md: save title uses `data.name` but formData has no `name` → "Prompt: undefined (date)". Download uses `formData.name` → always `prompt.md`.
- **Files:** `src/App.jsx` line 316, `BaseBuilderPanel.jsx` line 223
- **Impact:** User-facing bugs in new builder modes.
- **Action:** Add `name` or `title` to builder form config; fix save/export logic.

### 10. No test coverage reporting — LOW
- **Evidence:** No `--coverage` or coverage config in Playwright or node:test. No coverage thresholds.
- **Impact:** Cannot quantify coverage gaps or track regression.
- **Action:** Add `@playwright/test --reporter=html` (already used); consider `c8` or `nyc` for unit tests.

### 11. Unit tests require server spawn — MEDIUM
- **Evidence:** `tests/rate-limit.test.js` spawns `node server.js` and waits for readiness. No shared test server.
- **Impact:** Slower, flaky if port conflicts. Hard to run in parallel.
- **Action:** Consider mocking HTTP in rate-limit test or using a shared test harness.

### 12. Zod schema changes untested — MEDIUM
- **Evidence:** `lib/builder-schemas.js` defines Zod schemas for prompting/skillz/agentic. No tests assert schema parse success/failure for valid/invalid payloads.
- **Impact:** Schema changes (e.g., new category) can break UI without detection.
- **Action:** Add unit tests: `schema.parse(validPayload)` succeeds; `schema.safeParse(invalidPayload)` fails with expected errors.

---

## Immediate Next Actions (Top 5)

1. **Add builder mode E2E test** — Create `tests/e2e/prompting-mode.spec.js` that mocks `POST /api/score`, submits form, and asserts score card display. Unblocks confidence in builder workstream.
2. **Fix builder save/export bugs** — Add `name`/`title` to builder form config; fix `App.jsx` line 316 and `BaseBuilderPanel.jsx` line 223 so save title and download filename use correct field.
3. **Extract `mockReportCardResponse`** — Create `tests/fixtures/review-mocks.js` and update the three spec files to import. Reduces duplication and schema drift risk.
4. **Add ESLint + Prettier** — Minimal config (recommended + Prettier). Add `lint` and `format` scripts. Improves consistency and catches common issues.
5. **Add unit tests for `lib/builder-score.js`** — Test `scoreContent` with mocked `chatStructured`/`chatStream`; test `getTimeoutForModel` for various model names. Low effort, high value for builder reliability.

---

*Quality findings: 2026-03-14*
