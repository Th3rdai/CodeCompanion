---
name: plan
description: "Score and validate implementation plans before execution. Use when reviewing a plan, creating a plan, or checking if a plan is ready to implement."
---

# Skill: Plan Scoring

## Purpose

Evaluate implementation plans using AI to score Clarity, Feasibility, Completeness, and Structure — producing letter grades (A–F) and improvement suggestions.

## When to Apply

- User selects Planner mode in the desktop app
- User asks to review or validate a plan
- User asks 'is this plan good?' or 'is this plan ready?'
- Before implementing a complex feature

## Inputs

- Plan content (markdown string or structured fields)
- Optional: plan name, goal, steps, scope, dependencies, testing, risks

## Outputs

- Letter grades (A–F) for: Clarity, Feasibility, Completeness, Structure
- Overall grade
- Improvement suggestions
- Ready/not-ready verdict

## Procedure

1. **Receive plan** — Accept pre-assembled markdown in `content`, or structured fields
2. **Validate structure** — Ensure the plan has a goal and steps at minimum
3. **Score plan** — Call `builtin.score_plan` with the plan content or fields
4. **Format output** — Present grades in a report card format
5. **Surface suggestions** — List improvement suggestions ordered by impact
6. **Give verdict** — Ready (A/B overall) or Not Ready (C or below)

## Tool Binding

- `builtin.score_plan` — The core plan scoring pipeline

## Evaluation Criteria

- Grades must be deterministic for the same input + model
- Overall grade must be consistent with individual dimension grades
- Suggestions must be specific and actionable
- Plans scoring C or below must have at least 3 improvement suggestions
