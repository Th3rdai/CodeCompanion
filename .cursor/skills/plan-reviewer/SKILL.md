---
name: plan-reviewer
description: >-
  Reviews and validates implementation plans before execution—gaps, risks,
  dependencies, testing, and structured output. Use when the user provides a
  plan, architecture, or implementation strategy to validate; asks to create,
  review, improve, or check a plan; or mentions plan review, validate plan,
  implementation plan, architecture plan, or whether a plan is ready to build.
---

# Plan reviewer

Validate plans **before** implementation. Ensure they are complete, feasible, and executable with minimal ambiguity.

## Workflow

### 1. Analyze

Read the plan. Check for:

- **Undefined terms** — flag and ask or infer explicitly
- **Circular dependencies** — components that depend on each other in a cycle
- **Missing pieces** — error handling, testing, migration, rollback, observability

### 2. Issues log

For each issue:

| Field         | Content                  |
| ------------- | ------------------------ |
| Severity      | critical / major / minor |
| Description   | What is wrong or missing |
| Impact        | If unfixed               |
| Suggested fix | Concrete next step       |

### 3. Improve

Beyond fixes:

- Reduce duplication or unnecessary steps
- Performance (caching, lazy load) where relevant
- Edge cases and failure modes
- Security and maintainability

### 4. Validated output

Produce (or revise into) markdown with:

- **Overview** — what is built and how
- **Implementation steps** — numbered, actionable
- **Dependencies** — prerequisites and ordering
- **Error handling** — how failures surface and recover
- **Testing strategy** — how to verify
- **Risks** — pitfalls and mitigations

## Self-check (before handing off)

1. Read as the implementer: any unanswered questions?
2. Clear beginning → middle → end?
3. Edge cases and errors covered?
4. Feasible within stated constraints?

## Decision tree

| Plan type              | Emphasis                                                |
| ---------------------- | ------------------------------------------------------- |
| High-level only        | Feasibility, missing detail, expand into concrete steps |
| Detailed steps         | Correctness, dependencies, data flow, optimizations     |
| Incomplete / ambiguous | Request clarification; do not pretend gaps are resolved |
| Already strong         | Subtle risks, completeness, small optimizations         |

## Guardrails

- Do **not** assume undocumented external systems or APIs—call out assumptions.
- Do **not** skip testing or error handling in the written plan.
- Correctness first; avoid premature micro-optimization.
- For non-code plans, adapt the same structure (feasibility, risks, verification).

## Output

Return the **validated plan** as markdown suitable for Claude, Cursor, or a repo doc (e.g. `PLAN.md`).

## Examples

See [examples.md](examples.md) for sample input → output patterns.

## Reference application

This skill was exercised on **Code Companion**’s agent-terminal spec: repo file **`docs/CLIPLAN-plan-review.md`** (review of `CLIPLAN.md`).
