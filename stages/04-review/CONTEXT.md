# Stage 04: Review

## Purpose
Validate the app works end-to-end and meets all requirements.

## Inputs
| File | Section | Why |
|------|---------|-----|
| stages/03-build/output/ | All files | The built application |
| stages/01-research/output/feature-requirements.md | Features | Checklist to validate against |

## Process
1. Verify all four modes work
2. Test model switching
3. Test streaming responses
4. Test error handling (Ollama offline, bad input)
5. Test conversation history
6. Copy final files to project root

## Outputs
| File | Location |
|------|----------|
| review-checklist.md | stages/04-review/output/ |
| All app files | project root |

## Checkpoint
- [ ] All modes verified
- [ ] Streaming works
- [ ] Error handling tested
- [ ] Final files in project root
