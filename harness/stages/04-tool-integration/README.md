# Stage 4: Tool Integration

## Purpose

Integrate tools (builtin + MCP) that the agents will use. Ensure tool policies are respected and tools are properly configured.

## Agents Involved

- **Builder** — Configures and tests tool integrations
- **Reviewer** — Validates tool policies and safety

## Inputs

- Agent design from Stage 2
- Tool policies (`harness/configs/tools.yaml`)
- MCP server configurations

## Outputs

- Tool integration configuration
- Tool availability report
- Safety validation report

## Gate Criteria

- [ ] All required tools are available and functional
- [ ] Tool policies are enforced (no agent has tools outside its allowed list)
- [ ] MCP servers are connected and healthy
- [ ] Reviewer has validated safety constraints

## Handoff

→ Stage 5: Evaluation (evaluator + reviewer)
