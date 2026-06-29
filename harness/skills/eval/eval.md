---
name: eval
description: "Evaluate agent outputs against rubrics. Use when scoring AI-generated content, running eval cases, or checking quality."
---

# Skill: Evaluation

## Purpose

Evaluate agent outputs against defined rubrics and test cases to ensure quality and consistency.

## When to Apply

- After a build phase to verify quality
- When running eval cases from `harness/evals/cases/`
- When scoring AI-generated content against a rubric
- As part of the iterate stage in the lifecycle

## Inputs

- Agent output (code, plan, review, etc.)
- Rubric file (from `harness/evals/rubrics/`)
- Optional: eval case (from `harness/evals/cases/`)

## Outputs

- Score against rubric criteria
- Pass/fail per criterion
- Overall quality assessment
- Recommendations for improvement

## Procedure

1. **Receive output** — Accept the agent output to evaluate
2. **Load rubric** — Read the appropriate rubric from `harness/evals/rubrics/`
3. **Score output** — Evaluate the output against each rubric criterion
4. **Report results** — Present scores per criterion with pass/fail
5. **Recommend improvements** — List specific, actionable improvements

## Evaluation Criteria

- Scoring must be consistent for the same input + rubric
- Each criterion must have a clear pass/fail threshold
- Recommendations must reference specific rubric criteria
