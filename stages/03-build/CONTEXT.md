# Stage 03: Build

## Purpose
Implement the Code Companion as a Node.js server with a React frontend.

## Inputs
| File | Section | Why |
|------|---------|-----|
| stages/01-research/output/feature-requirements.md | Features, Data Model | What to build |
| stages/02-design/output/component-plan.md | Components, Layout | Frontend structure |
| stages/02-design/output/api-design.md | Endpoints | Backend structure |
| _config/brand-voice.md | Style | Visual guidelines |

## Process
1. Create package.json with dependencies
2. Build server.js — Express server with Ollama proxy and SSE streaming
3. Build public/index.html — React frontend with all four modes
4. Wire up conversation history (JSON file storage)
5. Add model detection and switching
6. Test end-to-end

## Outputs
| File | Location |
|------|----------|
| package.json | stages/03-build/output/ |
| server.js | stages/03-build/output/ |
| public/index.html | stages/03-build/output/public/ |

## Checkpoint
- [ ] Server starts and serves the frontend
- [ ] All four modes send correct prompts to Ollama
- [ ] Streaming responses render in real-time
- [ ] Model switching works
- [ ] Conversation history persists
