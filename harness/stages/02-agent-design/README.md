# Stage 2: Agent Design

## Purpose

Design the agent approach — which agents will be involved, what roles they play, and how they hand off work.

## Agents Involved

- **Planner** — Designs the agent workflow
- **Reviewer** — Validates the approach

## Inputs

- Task definition from Stage 1
- Available agent contracts (`harness/agents/`)
- Routing config (`harness/configs/routing.yaml`)

## Outputs

- Agent selection and role assignment
- Workflow diagram (text-based)
- Handoff sequence

## Gate Criteria

- [ ] Selected agents match the task requirements
- [ ] Handoff sequence is clear and unambiguous
- [ ] No agent is assigned work outside its contract scope
- [ ] Reviewer has approved the approach

## Handoff

→ Stage 3: Prompt Design (planner + reviewer)
