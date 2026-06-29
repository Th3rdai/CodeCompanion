# Stage 3: Prompt Design

## Purpose

Design and version prompts for the selected agents. Each prompt must follow the agent contract and be testable.

## Agents Involved

- **Planner** — Drafts prompts
- **Reviewer** — Validates prompt quality

## Inputs

- Agent contracts from Stage 2
- Existing prompts (`harness/prompts/<agent>/`)
- Task definition from Stage 1

## Outputs

- Versioned prompts in `harness/prompts/<agent>/`
- Prompt registry entry (`harness/prompts/registry.md`)

## Gate Criteria

- [ ] Each prompt follows its agent contract
- [ ] Prompts are versioned (v1, v2, ...)
- [ ] No prompt references files or paths that don't exist
- [ ] Reviewer has approved the prompts

## Handoff

→ Stage 4: Tool Integration (builder + reviewer)
