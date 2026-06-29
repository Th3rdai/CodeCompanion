# Stage 6: Iteration

## Purpose

Iterate on prompts, tools, or agent design based on evaluation feedback. Loop back to the relevant stage and refine.

## Agents Involved

- **Planner** — Decides what to iterate on
- **Builder** — Implements changes
- **Evaluator** — Re-evaluates after changes

## Inputs

- Evaluation report from Stage 5
- Failed criteria and root causes

## Outputs

- Revised prompts, tools, or agent design
- Updated evaluation report
- Iteration log entry in `harness/runs/`

## Gate Criteria

- [ ] Each iteration addresses a specific failure
- [ ] Changes are versioned (not overwriting previous versions)
- [ ] Re-evaluation shows improvement
- [ ] No regressions in previously passing criteria

## Handoff

→ Stage 5: Evaluation (re-evaluate) or Stage 7: Release (if all criteria pass)
