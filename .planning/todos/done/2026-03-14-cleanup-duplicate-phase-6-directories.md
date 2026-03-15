---
created: 2026-03-14T21:40:30.000Z
title: Cleanup duplicate Phase 6 directories
area: planning
files:
  - .planning/phases/06-desktop-app
  - .planning/phases/06-desktop-packaging
  - .planning/ROADMAP.md
---

## Problem

Two Phase 6 directories exist under `.planning/phases/`:
- `06-desktop-app/` — appears to be from initial roadmap setup, likely empty or minimal
- `06-desktop-packaging/` — has the actual `06-CONTEXT.md` from the discuss-phase session

The `gsd-tools init progress` output shows both as separate phases, which inflates the phase count and causes confusion in routing.

## Solution

1. Check contents of both directories
2. Consolidate to one directory (likely keep `06-desktop-packaging` since it has CONTEXT.md, or rename to match ROADMAP.md)
3. Update ROADMAP.md phase name/directory if needed
4. Delete the empty/duplicate directory
5. Verify `gsd-tools init progress` shows correct phase count after cleanup
