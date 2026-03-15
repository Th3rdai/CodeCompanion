# Phase 15: Build Mode (GSD + ICM) — Context

**Phase:** 15  
**Goal:** Add a Build mode that scaffolds a new project combining get-shit-done (GSD) and ICM Framework so users can build apps, tools, or software using both methodologies.  
**Status:** Approved plan; implementation complete (2026-03-14)

## Approved Plan

- Full plan (phases, risks, verification, pitfalls): [DRAFT-PLAN.md](./DRAFT-PLAN.md)
- Approval record: [APPROVED.md](./APPROVED.md)

## Deliverables

| Deliverable | Location | Status |
|-------------|----------|--------|
| Build scaffolder | lib/build-scaffolder.js | Done |
| Build API | server.js POST /api/build-project | Done |
| BuildWizard UI | src/components/BuildWizard.jsx | Done |
| App integration | MODES, handleBuildSuccess, tiers, license | Done |
| GSD + skills in scaffold | Embedded in build-scaffolder; skills/gsd-workflows.md | Done |

## Requirements

- BUILD-01: Build mode in tabs; wizard scaffolds .planning/ + stages/
- BUILD-02: CLAUDE.md, CONTEXT.md, skills/gsd-workflows.md; usable in Cursor/Claude Code
- BUILD-03: 403/409 handling; chat input hidden in Build mode

## Next

No further Phase 15 work. For future enhancements see “Out of Scope” in DRAFT-PLAN.md.
