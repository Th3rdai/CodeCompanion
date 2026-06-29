# Stage 7: Release

## Purpose

Finalize the work — commit changes, update documentation, and prepare for deployment.

## Agents Involved

- **Reviewer** — Final validation and sign-off

## Inputs

- All previous stage outputs
- Evaluation results (all passing)
- Change log

## Outputs

- Final commit with conventional commit message
- Updated CHANGELOG.md
- Release notes (if applicable)
- Run log in `harness/runs/`

## Gate Criteria

- [ ] All evaluation criteria are passing
- [ ] No uncommitted changes remain
- [ ] CHANGELOG.md is updated
- [ ] Documentation reflects the current state
- [ ] Reviewer has given final sign-off

## Completion

The run is complete. Log the run in `harness/runs/` with a summary of all stages.
