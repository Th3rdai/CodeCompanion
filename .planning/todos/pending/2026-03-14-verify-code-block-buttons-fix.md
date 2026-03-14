---
created: 2026-03-14T17:25:48.452Z
title: Verify code block buttons fix
area: ui
files:
  - src/components/MarkdownContent.jsx:88
---

## Problem

The Copy and Download buttons on code blocks in deep-dive conversations were invisible because the toolbar had `opacity:0` with hover-only JS listeners. Fix was applied in commit `e4400d1` — toolbar changed to always-visible `opacity:1` and hover listeners removed.

The fix has been committed and deployed but **never verified by the user** with a screenshot or confirmation that the buttons are now visible in the UI.

## Solution

Open a deep-dive conversation in Review mode that produces code blocks. Verify that Copy and Download buttons are visible on every code block without needing to hover. Take a screenshot to confirm.
