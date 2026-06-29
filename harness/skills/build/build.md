---
name: build
description: "Score prompting, skillz, agentic, and planner content. Use when evaluating AI builder content quality."
---

# Skill: Builder Scoring

## Purpose

Score AI builder content (prompting, skillz, agentic, planner) with letter grades — the same scoring as Builder mode in the UI.

## When to Apply

- User selects Builder mode in the desktop app
- User asks to score a prompt, skill, or agentic content
- User wants to evaluate the quality of AI builder content

## Inputs

- Content to score (string)
- Mode: prompting | skillz | agentic | planner
- Optional: metadata object

## Outputs

- Letter grades (A–F) for content quality dimensions
- Overall grade
- Improvement suggestions

## Procedure

1. **Receive content** — Accept the content string and mode
2. **Validate mode** — Must be one of: prompting, skillz, agentic, planner
3. **Score content** — Call `builtin.builder_score` with mode + content
4. **Format output** — Present grades in a readable format
5. **Surface suggestions** — List improvement suggestions

## Tool Binding

- `builtin.builder_score` — The core builder scoring pipeline

## Evaluation Criteria

- Grades must be deterministic for the same input + model
- Mode must be validated before scoring
- Suggestions must be specific to the content type
