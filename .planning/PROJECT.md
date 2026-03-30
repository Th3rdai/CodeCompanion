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
- ✓ **Toolbar Export** — multi-format chat export (11 formats: MD, TXT, HTML, JSON, PDF, DOCX, ODT, XLSX, ODS, CSV, PPTX), full chat or last reply, ZIP or multiple downloads (`ExportPanel`, `lib/office-generator.js`, `/api/generate-office`) — 2026-03

### Active

- [x] New "Review" mode with report-card output (grades for bugs, security, readability, completeness) — Phase 3 complete
- [x] Report card leads into conversational deep-dive on each category — Phase 3 complete
- [x] All input methods feed into review: paste, file upload, folder browse — Phase 3 complete
- [x] Friendly-teacher tone across all modes — analogies, no jargon, patience — Phase 2 complete
- [x] Reworked explain mode for zero-code-experience users — Phase 2 complete
- [x] Reworked bugs mode with plain-English severity and fix guidance — Phase 2 complete
- [x] Reworked refactor mode focused on "what should you ask your AI to change" — Phase 2 complete
- [x] Simplified UI for non-technical users (reduce cognitive load, clearer labels) — Phase 2 complete
- [ ] Copy-pasteable fix prompts for each finding — Phase 4
- [ ] Review history with full report card persistence — Phase 4
- [ ] Model capability warnings for small models — Phase 4
- [ ] Beginner-friendly onboarding flow (what is this tool, how to use it) — Phase 5
- [ ] Contextual help / tooltips explaining technical terms when they appear — Phase 5
- [ ] Privacy messaging visible in UI — Phase 5
- [ ] Electron desktop packaging (macOS, Linux, Windows) — Phase 6

### Out of Scope

- Multi-user auth / team features — local-only tool, single user
- Mobile app — desktop browser is the primary context for code review
- Code editing / IDE features — this is a reviewer, not an editor
- Automated code fixing — suggestions only, user takes action in their AI tool
- Support for non-Ollama LLM providers — Ollama-only for now

## Context

- Existing codebase is a working Express + React app with 8 modes (Chat, Explain, Safety Check, Clean Up, Code->Plain English, Idea->Code Spec, Review, Create)
- Target audience: vibe coders (non-technical AI-assisted developers)
- All input methods supported (paste, upload, file browse, GitHub clone)
- System prompts in `lib/prompts.js` rewritten with friendly-teacher tone (Phase 2 complete)
- Review mode with report card grading and deep-dive conversations (Phase 3 complete)
- Create mode with 5-step wizard and ICM/MAKER scaffolding (existing feature, UAT complete)
- File browser with IDE launchers (Claude Code, Cursor, Windsurf, OpenCode)
- Ollama runs on local network at configurable URL

## Constraints

- **Tech stack**: Keep existing Node.js/Express + React + Vite stack — no framework migration
- **AI provider**: Ollama only — no cloud API dependencies
- **Audience**: All text must be understandable by someone who has never written code manually
- **Tone**: Friendly teacher — use analogies, avoid jargon, explain technical terms when unavoidable

## Key Decisions

| Decision                                                          | Rationale                                                                                             | Outcome                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------- |
| Report card + conversation hybrid for review output               | Gives quick overview then lets users dig in at their own pace                                         | Implemented (Phase 3)   |
| Friendly teacher tone (not clinical or minimal)                   | Vibe coders need encouragement and context, not just facts                                            | Implemented (Phase 2)   |
| Improve existing modes AND add new review mode                    | Users benefit from consistency — all modes should speak the same language                             | Implemented (Phase 2+3) |
| Four review categories: bugs, security, readability, completeness | Covers what vibe coders most need to know about AI-generated code                                     | Implemented (Phase 3)   |
| Overwrite checkbox for Create wizard                              | Prevents accidental folder overwrites while allowing intentional ones                                 | Implemented             |
| Lucide React icons over emoji in report card                      | Better visual consistency and accessibility                                                           | Implemented             |
| Report card export (Markdown + JSON)                              | Users can save and share their code reviews                                                           | Implemented             |
| Unified chat export (11 server-generated formats)                 | Share conversations outside the app without copy-paste; same engine as builtin `generate_office_file` | Implemented (2026-03)   |

---

_Last updated: 2026-03-21_
