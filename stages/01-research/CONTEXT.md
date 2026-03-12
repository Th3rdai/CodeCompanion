# Stage 01: Research

## Purpose
Define features, understand Ollama's API, and plan the architecture.

## Inputs
| File | Section | Why |
|------|---------|-----|
| CLAUDE.md | Identity, Tech Stack | Project scope and constraints |

## Process
1. Define the four analysis modes and what each does
2. Document the Ollama API endpoints needed (chat, tags, streaming)
3. Plan the Node.js + Express architecture
4. Define data flow: user input → server → Ollama → streamed response
5. Document conversation history storage format

## Outputs
| File | Location |
|------|----------|
| feature-requirements.md | stages/01-research/output/ |
| ollama-api-reference.md | stages/01-research/output/ |

## Checkpoint
- [ ] Four modes fully defined
- [ ] Ollama API documented
- [ ] Architecture decided
- [ ] Data flow mapped
