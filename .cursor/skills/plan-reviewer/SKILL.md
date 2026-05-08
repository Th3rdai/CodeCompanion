---
name: plan-reviewer
description: "Reviews and validates implementation plans before execution. Use when users provide a plan, architecture, or implementation strategy that needs validation, or when they ask to review, validate, or improve a plan before starting development. Triggers: review plan, validate plan, create plan, plan review, implementation plan, architecture plan, is this plan good, plan check."
---
# Plan Reviewer

Review and validate implementation plans before they're executed. Ensure plans are complete, feasible, **grounded in the actual codebase**, and free of internal contradictions.

## When to Apply

- User provides a plan document and asks for review, validation, or improvement
- User asks "is this plan ready?" / "review my plan" / "is this safe to implement?"
- Before implementing a complex feature (validate the approach first)
- A plan file (e.g. `*PLAN*.md`, `*plan*.md`, `*FIX*.md`) is referenced
- User asks for an iteration on an existing plan

## Core principle

**Treat the plan as untrusted input.** Every behavioral claim it makes ("function X returns Y", "data has shape Z", "convention is W") must be **independently re-verified** against the current codebase on every iteration — not against your own prior verification.

If you can't quote the file:line that proves a claim, you haven't verified it.

## Workflow

### Phase 0 — Codebase Reconnaissance (BEFORE reading the plan)

Spend 3–5 minutes orienting in the code area the plan touches, before letting the plan frame your assumptions:

- `ls` the test directories the plan would write into — catches "create new test file" claims that duplicate existing files.
- `grep` the main symbols / concepts the plan mentions — confirm they exist and find their actual shape.
- Read the actual data structure for any types the plan operates on (message shape, config keys, error envelopes, role conventions).
- Note conventions the plan must match (role names, error formats, naming).

Write down what you found in 3–5 bullets. This is your **codebase ground truth**. The plan's claims will be evaluated against this, not the other way around.

**Anti-pattern:** Skipping Phase 0 and assuming standard conventions (OpenAI message format, REST verbs, default test layouts). Project-specific deviations — e.g. tool results pushed as `role: "user"` instead of `role: "tool"` — are exactly what Phase 0 catches.

### Phase 1 — Extract Claims from the Plan

Read the plan once and produce a flat list of **verifiable claims**. Examples:

- "Function `parseFoo` at lib/x.js:42 returns `{a, b}`"
- "Tool results are pushed with `role: 'tool'`"
- "Config key `enableX` defaults to `false`"
- "Test file `tests/unit/foo.test.js` does not yet exist"
- "Phase 1 ships before Phase 2"

Mark each claim **unverified**. Do not evaluate them yet.

### Phase 2 — Independent Verification (Reality-Match Pass)

For **every** claim from Phase 1, independently prove or refute it against the codebase. Two rules:

1. **No transitive trust.** If a prior iteration of the review verified claim X, re-verify it from scratch this iteration. Files change between iterations.
2. **Quote the evidence.** "I verified line 489" is not enough. Quote the line content. If you can't, the claim is unverified.

Categorize each claim as:
- ✓ **Verified** — quoted evidence supports it.
- ✗ **Wrong** — evidence contradicts it. **Critical issue.**
- ⚠ **Imprecise** — partly right; needs clarification.
- ❓ **Unverifiable** — couldn't find evidence either way. Flag and ask.

**Anti-pattern (anchoring bias):** "I verified this in iteration 1, no need to re-check." Wrong. Each iteration starts fresh.

### Phase 3 — Internal Consistency Scan (Doc-Coherence Pass)

Separately from codebase truth, look for contradictions **inside the plan**:

- Test specs that contradict feature specs (e.g., test asserts both buttons present while feature spec says button B is conditionally hidden).
- Config-key naming drift across sections (`fooBar` in one section, `foo_bar` in another).
- Numbers that disagree across sections (defaults table says `100000`, phase body says `100,000`).
- SSE / event / API contract names declared in one section, never emitted in another.
- Phase ordering claims that don't match dependency chains.
- Verification commands that don't match what the build script actually runs (`npm test` listed for unit tests when `npm test` runs Playwright).

Run this as a **distinct pass** — Phase 2 catches mismatches with reality, Phase 3 catches mismatches within the doc. Both fail modes happen.

### Phase 4 — Implementer's Shadow Pass

Pretend you're picking up the plan to start coding right now. For the first phase listed, ask:

- Can I open the right file and start typing? Or do I need to make a judgment call the plan didn't decide?
- Are referenced helpers / functions named with their actual exports? (Not `getModelContext` if the function is `fetchContextLength`.)
- Are "new file" claims preceded by an existence check?
- Do test specs reference real test runners and real existing test files where applicable?
- Is there a `<TBD>` / "decide during implementation" / "see below" anywhere that should already be resolved?

Anything that would make a real implementer pause is a **major** issue.

### Phase 5 — Categorize Issues

| Severity | Definition |
|----------|------------|
| **Critical** | Codebase-truth mismatch — implementer following the plan would produce wrong code. |
| **Major** | Internal contradiction OR missing concrete detail that blocks implementation. |
| **Minor** | Polish, edge case, or improvement not strictly required to ship. |

For each issue, record: **what's wrong**, **evidence** (file:line quote or section reference), **concrete fix** (specific replacement text, not "consider revising").

### Phase 6 — Propose Improvements

Beyond fixing issues, suggest:

- **Reuse over creation** — existing helpers / tests / configs that the plan should extend instead of duplicate.
- **Edge cases** — error paths, race conditions, empty inputs, large inputs, concurrent calls.
- **Security** — input validation, path traversal, auth on new endpoints, secret handling.
- **Testability** — assertions that would catch regressions you noticed.

Don't propose abstractions or features beyond the plan's scope. Don't gold-plate.

### Phase 7 — Produce the Review

```markdown
# Plan Review: [Plan Name] (iteration N)

## Verdict: READY / NEEDS REVISION / BLOCKED

## Summary
[1–3 sentences. Lead with the verdict reason.]

## Codebase ground truth (Phase 0)
- [bullet]
- [bullet]

## Issues

### Critical (codebase mismatches)
- **[claim]** — Evidence: `file.js:NN` shows `<actual>`. Plan says `<plan claim>`. Fix: `<exact replacement>`.

### Major (internal contradictions / missing detail)
- **[issue]** — Where: section X says A, section Y says B. Fix: `<exact replacement>`.

### Minor
- ...

## Improvements
- [reuse / edge case / security suggestion + why]

## Verification log
- [claim] → ✓ verified at file:line
- [claim] → ✗ wrong; actual is X
- [claim] → ❓ unverifiable; need user input on Z
```

### Phase 8 — Self-Check

Before delivering the review:

1. **Did I run Phase 0 this iteration?** Or did I trust prior runs? Re-run if in doubt.
2. **Does every Critical / Major issue have a quoted evidence line?** If "I think X is wrong" without a quote, demote to ❓.
3. **Did I separate Phase 2 (reality) from Phase 3 (doc coherence)?** Each catches different bugs.
4. **For "new artifact" claims, did I check the dir for existing files?**
5. **Would an implementer be blocked by anything I let pass?** That's the implementer's-shadow check.

## Common failure modes

These are the gaps that escape thorough-looking reviews. Watch for them explicitly:

| Failure mode | Symptom | Fix |
|---|---|---|
| **Anchoring bias** | "Verified in iteration 1, didn't re-check." Plan has rotted; review trusts stale verification. | Phase 2 rule: no transitive trust. Always re-verify. |
| **Coherence-only review** | Review checks line citations and config-key alignment but not whether the underlying claim matches reality. | Phase 2 (reality) AND Phase 3 (coherence) as distinct passes. |
| **Sanity-check skipped** | Plan says "create new file X". Reviewer doesn't `ls` the dir. File X already exists. | Phase 0 mandates the `ls`. |
| **Convention assumption** | Plan assumes OpenAI-standard message format. Project uses different. Reviewer never grounds in actual code. | Phase 0 reads actual data shapes before evaluating plan. |
| **Self-contradiction blindness** | Two sections of the same plan contradict; reviewer reads each in isolation. | Phase 3 explicit cross-section scan. |
| **Implementer's gaps tolerated** | Plan says "decide during implementation" or leaves a `<TBD>`. Reviewer accepts. | Phase 4 implementer's-shadow pass; any TBD is at least Major. |

## Decision Tree

- **High-level / overview plan** → focus Phase 4 on missing concreteness; expand the plan, don't just validate.
- **Detailed plan** → focus Phase 2 + 3 heavily; the plan claims a lot, verify the lot.
- **Iteration of an existing plan** → re-run Phase 2 from scratch; don't assume prior iterations got the verification right.
- **Plan you wrote yourself** → especially run Phase 0 and Phase 2; self-anchoring is the strongest bias.

## Watch Out For

- **Don't trust your earlier self.** Each iteration re-verifies.
- **Don't conflate doc-coherence with codebase-truth.** Different passes, different bugs.
- **Don't accept abstract claims.** "Function does the right thing" is not verification — quote what it actually does.
- **Don't propose new abstractions** beyond the plan's scope unless they remove a real risk.
- **Don't skip Phase 0.** Five minutes of orientation prevents an hour of wrong review.
