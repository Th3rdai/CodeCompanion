# Stage 5: Evaluation

## Purpose

Evaluate the complete setup — prompts, tools, and agent workflow — against rubrics and test cases.

## Agents Involved

- **Evaluator** — Scores outputs against rubrics
- **Reviewer** — Validates evaluation results

## Inputs

- Prompts from Stage 3
- Tool integrations from Stage 4
- Eval cases (`harness/evals/cases/`)
- Rubrics (`harness/evals/rubrics/`)

## Outputs

- Evaluation report with scores per criterion
- Pass/fail summary
- Recommendations for improvement

## Gate Criteria

- [ ] All eval cases have been run
- [ ] Each criterion has a clear pass/fail verdict
- [ ] Overall quality score meets the threshold (B or above)
- [ ] Failures have documented root causes

## Handoff

→ Stage 6: Iteration (if improvements needed) or Stage 7: Release (if passing)
