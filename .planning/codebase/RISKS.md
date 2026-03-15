# Codebase Risks — v2.0 Builder Modes & Desktop/Web Parity

**Analysis Date:** 2026-03-14

**Focus:** Near-term risks for v2.0 builder modes (Prompting/Skillz/Agentic) and desktop/web parity.

**Legend:**
- **Confirmed:** Observed in code or config
- **Assumed:** Inferred from architecture or dependencies; not yet verified

---

## Key Risks (8–12 with Ratings)

### 1. Builder modes have zero test coverage
| Severity | Likelihood | Impact |
|----------|------------|--------|
| High | Confirmed | High |

**Status:** Confirmed. No tests for `PromptingPanel`, `SkillzPanel`, `AgenticPanel`, `BaseBuilderPanel`, `/api/score`, or `lib/builder-score.js`.

**Impact:** Regressions go unnoticed. Schema changes, parse logic, or SSE fallback can break silently.

**Mitigation:**
1. Add Playwright component test for BaseBuilderPanel: fill form, mock `/api/score` JSON response, assert score card renders.
2. Add server-side unit test for `scoreContent()` with mocked Ollama: verify schema validation and fallback path.
3. Add E2E smoke test: select builder mode, submit minimal content, assert no crash.

**Verification:** `npx playwright test tests/ui/builders` passes; `node -e "require('./lib/builder-score').scoreContent(...)"` covered.

---

### 2. Builder save title uses undefined `data.name`
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Medium | Confirmed | Medium |

**Status:** Confirmed. `src/App.jsx` line 316: `handleSaveBuilder` uses `data.name` for title, but builder formData has no `name` field. Skillz uses `skillName`, Agentic uses `agentName`, Prompting has no name field.

**Impact:** Saved conversations show "Prompt: undefined (date)", "Skill: undefined (date)", "Agent: undefined (date)".

**Mitigation:**
1. Derive display name: `data.formData?.skillName || data.formData?.agentName || data.formData?.content?.slice(0, 30) || 'Untitled'`.
2. Add unit test asserting title is non-empty for each builder mode.

**Verification:** Save a skill/agent/prompt and confirm sidebar shows correct title.

---

### 3. Builder download filename uses wrong field
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Low | Confirmed | Low |

**Status:** Confirmed. `BaseBuilderPanel.jsx` line 223: `formData.name` is used for filename. No config defines `name`; all use `defaultFilename` fallback.

**Impact:** Downloads always use generic names (e.g. `prompt.md`, `SKILL.md`, `agent.md`) instead of user-provided names.

**Mitigation:**
1. Use mode-specific field: `formData.skillName || formData.agentName || formData.content?.slice(0, 20)?.replace(/\s/g, '-') || config.defaultFilename`.
2. Sanitize filename (remove path chars, limit length).

**Verification:** Download from each builder mode; filename reflects content.

---

### 4. Small models fail structured output; SSE fallback may not parse
| Severity | Likelihood | Impact |
|----------|------------|--------|
| High | Assumed | High |

**Status:** Assumed. `lib/builder-score.js` falls back to chat stream when `chatStructured` fails (Zod parse or Ollama error). `BaseBuilderPanel.jsx` lines 193–206 accumulates SSE tokens and `JSON.parse(accumulated)` — if model returns prose instead of JSON, parse fails with generic "Could not parse score response."

**Impact:** Users with &lt;7B models get unhelpful error or raw prose in UI. STATE.md notes "Small model (&lt;7B) structured output quality is LOW confidence."

**Mitigation:**
1. Add model-tier warning (like Review mode) before scoring when model is &lt;7B.
2. In fallback path, detect non-JSON and show: "The model returned text instead of a score. Try a larger model (7B+) or use the Revise with AI flow."
3. Add integration test with mocked small-model response.

**Verification:** Run with 1B/3B model; confirm warning and graceful fallback message.

---

### 5. Ollama JSON Schema format requires 0.5.0+
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Medium | Assumed | High |

**Status:** Assumed. STATE.md: "Ollama version at 192.168.50.7:11424 must be 0.5.0+ for JSON Schema `format` support." `lib/ollama-client.js` uses `format: jsonSchema` in `chatStructured`.

**Impact:** Older Ollama returns errors or ignores format; structured scoring fails for all users on old installs.

**Mitigation:**
1. Add Ollama version check on connection (e.g. `/api/version` or tags response).
2. Show warning in builder UI: "Ollama 0.5.0+ recommended for scoring."
3. Document minimum version in README and Settings.

**Verification:** Test against Ollama 0.4.x; confirm clear message.

---

### 6. Desktop vs web data path divergence
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Medium | Confirmed | Medium |

**Status:** Confirmed. Electron uses `app.getPath('userData')/CodeCompanion-Data`; web dev uses `./history`, `./.cc-config.json`. `electron/data-manager.js` migrates legacy paths, but web users running `npm start` never see Electron paths.

**Impact:** Users switching between web and desktop may have two separate config/history sets. Export/import exists but is manual.

**Mitigation:**
1. Document in README: "Desktop app stores data in [path]. Web dev uses project directory."
2. Add Settings UI note when in Electron: "Data location: [resolved path]."
3. Consider `CC_DATA_DIR` env var for web to point to shared location (future).

**Verification:** Run web and Electron; confirm data locations documented and visible.

---

### 7. Builder parse logic is regex-fragile (parseLoaded)
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Medium | Confirmed | Medium |

**Status:** Confirmed. `PromptingPanel.jsx`, `SkillzPanel.jsx`, `AgenticPanel.jsx` use regex and `split(/\n## /)` in `parseLoaded`. Edge cases: empty sections, alternate headings (###), unicode, malformed frontmatter.

**Impact:** Loaded files may partially populate or corrupt form state. User edits outside app can break round-trip.

**Mitigation:**
1. Add defensive checks: `if (!content) return result;` (already present). Handle `sections[0]` empty.
2. Add unit tests: valid file, missing sections, extra headings, unicode in content.
3. Consider markdown parser (e.g. remark) for robust section extraction (future).

**Verification:** Load hand-edited .md with odd formatting; form populates correctly.

---

### 8. BaseBuilderPanel SSE parsing has empty catch
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Low | Confirmed | Low |

**Status:** Confirmed. `BaseBuilderPanel.jsx` lines 184–188, 302–314: `try { const parsed = JSON.parse(payload); ... } catch {}` — errors are swallowed.

**Impact:** Malformed SSE lines fail silently; debugging harder. Same pattern as existing CONCERNS.md "Silent error handling."

**Mitigation:**
1. Replace with `catch (e) { console.warn('SSE parse:', e.message); }`.
2. Optionally surface parse failures in UI for support.

**Verification:** Inject bad SSE line; console shows warning.

---

### 9. Zod `z.toJSONSchema()` output compatibility with Ollama
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Low | Assumed | High |

**Status:** Assumed. `lib/builder-schemas.js` uses Zod v4 native `z.toJSONSchema()`. STATE.md previously noted zod-to-json-schema compat; project uses native. Ollama's `format` expects JSON Schema — dialect differences could cause rejections.

**Impact:** Ollama may reject or misinterpret schema; structured scoring fails.

**Mitigation:**
1. Log the generated schema in debug mode: `DEBUG=1` prints schema sent to Ollama.
2. Test with multiple Ollama versions; document known-good schema shape.
3. Add integration test: real Ollama call with minimal prompt, assert valid score structure.

**Verification:** `DEBUG=1 npm start`; POST to `/api/score`; inspect logs for schema.

---

### 10. Builder history not restored on conversation load
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Low | Assumed | Medium |

**Status:** Assumed. `src/App.jsx` lines 234–236 restore `savedBuilderData` when loading conversation. `listConversations` includes `overallGrade` from `builderData?.scoreData?.overallGrade`. Need to confirm full `builderData` is returned by `getConversation` and passed to panel.

**Impact:** User reopens saved builder conversation; form or score may be empty.

**Mitigation:**
1. Trace load path: `getConversation` → `setSavedBuilderData` → `savedData` prop to BaseBuilderPanel.
2. Add E2E test: save builder, switch conversation, reload builder conversation, assert form and score visible.
3. Verify `saveConversation` persists `builderData` in conversation JSON.

**Verification:** Save scored prompt, switch to chat, switch back to that conversation; form and score restored.

---

### 11. Agentic tools field parse round-trip can drop formatting
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Low | Confirmed | Low |

**Status:** Confirmed. `AgenticPanel.jsx` line 87: `parseLoaded` maps tools with `.replace(/^-\s*\*\*(.+?)\*\*:\s*/, '$1 — ')` — uses `$1` in replace string; in JavaScript `$1` is valid backreference. But `buildContent` uses `—` (em dash) or `-` (hyphen) as separator. Inconsistent separators could cause parse/build mismatch.

**Impact:** Loaded agent file with `-` instead of `—` may parse incorrectly; round-trip could alter tool list.

**Mitigation:**
1. Normalize to single separator (e.g. ` — `) in both parse and build.
2. Add unit test: build content, parse, build again; assert output matches.

**Verification:** Create agent with 3 tools, save, reload, save again; tool list unchanged.

---

### 12. Desktop builder modes and last-mode persistence
| Severity | Likelihood | Impact |
|----------|------------|--------|
| Low | Confirmed | Low |

**Status:** Confirmed. `electron/main.js` saves `lastActiveMode` to config. Builder modes (`prompting`, `skillz`, `agentic`) are in MODES; `setMode` calls `setLastMode`. No known bug.

**Impact:** Low. Desktop users reopening app should land on last-used builder mode.

**Mitigation:**
1. Manual test: open prompting, quit, reopen; mode is prompting.
2. Add to integration checklist.

**Verification:** Manual verification in Phase 6 human check.

---

## Mitigation Plan Summary

| Priority | Risk | Action | Owner |
|---------|------|--------|-------|
| P0 | #1 Builder test coverage | Add component + server + E2E tests for builders | Dev |
| P0 | #4 Small model fallback | Model-tier warning + clearer fallback message | Dev |
| P1 | #2 Save title undefined | Fix `handleSaveBuilder` to use mode-specific name field | Dev |
| P1 | #5 Ollama version | Version check + UI warning for &lt;0.5.0 | Dev |
| P1 | #6 Desktop/web data paths | Document + Settings path display | Dev |
| P2 | #3 Download filename | Use mode-specific field for filename | Dev |
| P2 | #7 Parse robustness | Defensive parse + unit tests | Dev |
| P2 | #8 Empty catch | Add console.warn in SSE parse catch | Dev |
| P3 | #9 Schema compat | Debug logging + integration test | Dev |
| P3 | #10 History restore | Trace and E2E verify | Dev |
| P3 | #11 Agent tools round-trip | Normalize separator + test | Dev |

**Recommended order:** P0 first (tests + small-model UX), then P1 (title fix, version check, docs), then P2/P3 as capacity allows.

---

*Risks analysis: 2026-03-14*
