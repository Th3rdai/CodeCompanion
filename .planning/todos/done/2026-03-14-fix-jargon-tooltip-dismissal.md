---
created: 2026-03-14T21:39:45.720Z
title: Fix jargon tooltip dismissal
area: ui
files:
  - src/components/MarkdownContent.jsx:182
  - src/components/JargonGlossary.jsx:242
---

## Problem

Jargon definition tooltips (the popup that appears when hovering over dotted-underline terms like "Schema", "API") could not be closed by clicking. The tooltip had `pointer-events-none` which prevented any click interaction. Users had to wait for the 3-second auto-dismiss or mouse away from the term.

Two separate tooltip implementations exist:

1. **MarkdownContent.jsx** (line 182) — the active one used in chat responses
2. **JargonGlossary.jsx** (line 242) — the `JargonTooltip` component (exported but not currently imported anywhere)

Both had `pointer-events-none` on the tooltip div.

## Solution

Changed both tooltips from `pointer-events-none` to `cursor-pointer` with `onClick` dismiss handler. In MarkdownContent.jsx, added a `dismissedAt` ref with 500ms suppression window to prevent the tooltip from immediately re-triggering when the click passes through to the underlying jargon term.

Changes made but **not yet committed**:

- `MarkdownContent.jsx`: `pointer-events-none` → `cursor-pointer`, added `dismissTooltip` callback with `dismissedAt` ref
- `JargonGlossary.jsx`: `pointer-events-none` → `cursor-pointer`, added `onClick` (also externally modified to replace emoji with Lucide `BookOpen` icon)

Needs: `npx vite build` then commit both files.
