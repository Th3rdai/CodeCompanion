# Efficiency Review: Command Set

Analysis focused on reducing redundancy, tightening wording, and making execution faster for both humans and agents.

---

## 1. Journal entry duplication (high impact)

**Issue:** The same 3-step journal convention is copy-pasted in six places: `build-prp.md`, `execute-prp.md`, `validate.md`, `example-validate.md`, `generate-validate.md` (output instructions), and implicitly in `summarize.md`. Any change to the convention requires editing multiple files.

**Efficiency gain:** Single source of truth. Define the convention once; other commands reference it.

**Change:** Add a short **Journal** section in `ADD-TO-PROJECT.md` (or a one-file `JOURNAL.md` in commands): format lines, `mkdir -p journal`, and `journal/README.md` rule. In each command, replace the full block with: _"Append a journal entry (see ADD-TO-PROJECT § Journal). Format: `HH:MM | <command> | <context> | <outcome>`."_ Validation-specific format (Pass/Fail, P1:OK…) can stay in validate/example-validate as one line.

**Applied:** Commands now reference a single journal convention in ADD-TO-PROJECT; validate/example-validate keep one-line format; build-prp/execute-prp use short reference + their format line.

---

## 2. build-prp Phase 3 duplicates execute-prp (medium impact)

**Issue:** Phase 3 step 2 "Build (same as Execute PRP)" then lists the same 6 bullets as execute-prp (TodoWrite, implement, validation, fix, report). Duplication causes drift if execute-prp is updated.

**Efficiency gain:** One place defines the implementation flow; build-prp points to it.

**Change:** In build-prp Phase 3 step 2, replace the bullet list with: _"Same flow as `/execute-prp`: implementation plan (TodoWrite), implement step by step, run each PRP validation command, fix failures and re-run until pass, complete checklist, final validation, report. See execute-prp.md for full steps."_

**Applied:** build-prp now references execute-prp instead of repeating the list.

---

## 3. generate-validate template referenced three times (low impact)

**Issue:** Prerequisites, Step 2, and Output all mention `example-validate.md` / `.claude/commands/example-validate.md`. Redundant and path-specific.

**Efficiency gain:** Shorter doc; one canonical reference.

**Change:** Keep Prerequisites as the single place that names the template. In Step 2 and Output use "the example template" or "example-validate.md (structure and journal format)". Drop the duplicate "Use ... as the template" sentence after Prerequisites.

**Applied:** Removed duplicate template sentence; Step 2 and Output refer to "example template" / "example-validate.md".

---

## 4. execute-prp step 8 is non-actionable (low impact)

**Issue:** "Reference the PRP – You can always reference the PRP again if needed" doesn't change behavior.

**Efficiency gain:** Less noise; keep only actionable note.

**Change:** Remove step 8 or merge into the existing Note: "If validation fails or you're stuck, re-read the PRP for validation commands and checklist."

**Applied:** Step 8 removed; Note at end updated to include re-read PRP when stuck.

---

## 5. new-project "After Creation" skips PRD (medium impact)

**Issue:** Next step says "Run: /generate-prp INITIAL.md". Standard workflow is INITIAL → PRD → PRP; skipping PRD can confuse and cause rework.

**Efficiency gain:** Correct default path; fewer wrong first steps.

**Change:** "Run: /generate-prd (from INITIAL.md), then /generate-prp PRDs/<name>.md. Or /generate-prp INITIAL.md to go straight to a plan."

**Applied:** After-creation steps now suggest PRD then PRP, with optional direct PRP.

---

## 6. ADD-TO-PROJECT file list is brittle (low impact)

**Issue:** Explicit list of 12 .md files will get out of date when commands are added/renamed.

**Efficiency gain:** Fewer manual updates; one rule.

**Change:** Add: "Copy all `*.md` from this folder into the target, except ADD-TO-PROJECT.md and EFFICIENCY-REVIEW.md (reference only)." Keep the list as an optional checklist.

**Applied:** ADD-TO-PROJECT now says "Copy all \*.md except ADD-TO-PROJECT.md and EFFICIENCY-REVIEW.md" with list as optional checklist.

---

## 7. build-prp Phase 1 – merge two bullets (micro)

**Issue:** "Resolve relative path" and "Confirm the file exists" are two steps that can be one.

**Change:** "Resolve to full path under project (e.g. PRPs/daily-quote-app.md). If missing, list PRPs/ (excluding templates/ and prompts/) and ask which to use."

**Applied:** Single bullet for resolve + confirm.

---

## 8. generate-prp – clarification only when needed (micro)

**Issue:** "User Clarification (if needed)" can trigger unnecessary back-and-forth.

**Change:** Add "(only if scope or patterns are unclear)" so agents don't ask every time.

**Applied:** User clarification step qualified.

---

## 9. e2e-test pre-flight – stop on first failure (micro)

**Issue:** Pre-flight has three checks; agents might run all before stopping.

**Change:** Add at top of Pre-flight: "Run in order; stop and report if any check fails."

**Applied:** One-line instruction added.

---

## 10. generate-validate journal in output (consistency)

**Issue:** generate-validate tells the generator to "include a final section" with the full 3-step journal text again.

**Efficiency gain:** Reference the convention instead of repeating it.

**Change:** "The generated /validate command MUST include a 'Journal entry' section. Use the same format as example-validate.md (ensure journal/ exists, append one line to journal/YYYY-MM-DD.md, optional journal/README.md update)."

**Applied:** Output section references example-validate journal format instead of repeating the three steps.

---

## Summary of efficiency improvements

| #   | Change                                                              | Effect                                |
| --- | ------------------------------------------------------------------- | ------------------------------------- |
| 1   | Single journal convention in ADD-TO-PROJECT; commands reference it  | One place to update; less duplication |
| 2   | build-prp Phase 3 references execute-prp instead of repeating steps | Single source for implementation flow |
| 3   | generate-validate: one template reference                           | Shorter, less path drift              |
| 4   | execute-prp: remove step 8, strengthen Note                         | Clearer, actionable only              |
| 5   | new-project: suggest PRD then PRP                                   | Correct default workflow              |
| 6   | ADD-TO-PROJECT: copy all \*.md except reference docs                | List doesn’t need constant updates    |
| 7   | build-prp Phase 1: one bullet for resolve + confirm                 | Fewer steps                           |
| 8   | generate-prp: clarify only when unclear                             | Fewer unnecessary questions           |
| 9   | e2e-test: pre-flight run in order, stop on fail                     | Avoid wasted work                     |
| 10  | generate-validate output: reference journal format                  | No repeated journal block             |

---

## Not changed (by design)

- **Summarize "When to Run"**: Four bullets are useful for quick scanning; left as-is.
- **Full journal text in validate.md / example-validate.md**: These are the runnable commands; keeping the exact format there avoids a lookup during execution. ADD-TO-PROJECT documents the convention; validate/example-validate keep their copy so the AI has it in-context when running /validate.
- **generate-prompt structure**: Already well-scoped; no efficiency win from condensing.
