# Code Companion — Vibe Coder Edition

## What This Is

Code Companion is a web app that helps non-technical "vibe coders" — people who use AI tools like Cursor, Replit, or ChatGPT to generate code but don't understand what it does — review, understand, and improve their AI-generated code. It connects to locally-hosted Ollama LLMs to provide friendly, jargon-free explanations, code reviews with report-card-style grading, and guided fix suggestions. Think of it as a patient teacher who checks your homework and explains what to fix.

## Core Value

A vibe coder can paste, upload, or point to their AI-generated code and get a clear, honest assessment of whether it's safe to ship — explained in language they actually understand.

## Requirements

### Validated

- ✓ Real-time AI chat with streaming responses via SSE — existing
- ✓ Multiple analysis modes (explain, bugs, refactor, translate) — existing
- ✓ Mode-specific system prompts for different PM workflows — existing
- ✓ Conversation history with save/load/archive — existing
- ✓ File browser for navigating project directories — existing
- ✓ File upload and drag-drop attachment — existing
- ✓ GitHub repo cloning and browsing — existing
- ✓ Model auto-detection from Ollama — existing
- ✓ MCP tool integration with agentic loops — existing
- ✓ Dashboard with usage analytics — existing
- ✓ Create mode with ICM project scaffolding — existing
- ✓ 3D visual effects and splash screen — existing
- ✓ Markdown rendering with syntax highlighting — existing

### Active

- [ ] New "Review" mode with report-card output (grades for bugs, security, readability, completeness)
- [ ] Report card leads into conversational deep-dive on each category
- [ ] All input methods feed into review: paste, file upload, folder browse, GitHub URL
- [ ] Friendly-teacher tone across all modes — analogies, no jargon, patience
- [ ] Reworked explain mode for zero-code-experience users
- [ ] Reworked bugs mode with plain-English severity and fix guidance
- [ ] Reworked refactor mode focused on "what should you ask your AI to change"
- [ ] Beginner-friendly onboarding flow (what is this tool, how to use it)
- [ ] Simplified UI for non-technical users (reduce cognitive load, clearer labels)
- [ ] Contextual help / tooltips explaining technical terms when they appear

### Out of Scope

- Multi-user auth / team features — local-only tool, single user
- Mobile app — desktop browser is the primary context for code review
- Code editing / IDE features — this is a reviewer, not an editor
- Automated code fixing — suggestions only, user takes action in their AI tool
- Support for non-Ollama LLM providers — Ollama-only for now

## Context

- Existing codebase is a working Express + React app with 7 analysis modes
- Target audience is shifting from PMs to vibe coders (non-technical AI-assisted developers)
- The app already supports all needed input methods (paste, upload, file browse, GitHub clone)
- System prompts in `lib/prompts.js` drive mode behavior and can be reworked for tone
- Codebase has known tech debt: monolithic files (server.js 793 lines, App.jsx 664 lines), silent error handling, no tests for critical paths
- Ollama runs on local network at configurable URL

## Constraints

- **Tech stack**: Keep existing Node.js/Express + React + Vite stack — no framework migration
- **AI provider**: Ollama only — no cloud API dependencies
- **Audience**: All text must be understandable by someone who has never written code manually
- **Tone**: Friendly teacher — use analogies, avoid jargon, explain technical terms when unavoidable

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Report card + conversation hybrid for review output | Gives quick overview then lets users dig in at their own pace | — Pending |
| Friendly teacher tone (not clinical or minimal) | Vibe coders need encouragement and context, not just facts | — Pending |
| Improve existing modes AND add new review mode | Users benefit from consistency — all modes should speak the same language | — Pending |
| Four review categories: bugs, security, readability, completeness | Covers what vibe coders most need to know about AI-generated code | — Pending |

---
*Last updated: 2026-03-13 after initialization*
