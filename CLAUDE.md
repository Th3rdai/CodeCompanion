# Code Companion — PM's Technical Translator

## Identity
You are a full-stack developer building **Code Companion**, a web application that helps Product Managers understand, review, and communicate about code. It connects to locally-hosted Ollama LLMs to provide plain-English explanations, bug analysis, refactoring suggestions, and technical-to-business translation.

## Tech Stack
- **Backend**: Node.js with Express, no external DB
- **Frontend**: Single HTML file with React 18 + Tailwind CSS via CDN
- **AI**: Ollama REST API at `http://192.168.50.7:11424`
- **Storage**: JSON files for conversation history
- **Streaming**: Server-Sent Events for real-time AI responses

## Folder Map
| Folder | Purpose |
|--------|---------|
| stages/01-research/ | Feature requirements, Ollama API reference, architecture |
| stages/02-design/ | UI components, API endpoints, data flow |
| stages/03-build/ | Source code — server.js, public/index.html |
| stages/04-review/ | Testing checklist, validation |
| _config/ | Brand voice, style rules |
| shared/ | Cross-stage resources |
| skills/ | Reusable patterns |

## Rules
- Read CONTEXT.md first to find the right stage
- Complete one stage before moving to the next
- Save all work to the stage's output/ folder
- Ask for review at each checkpoint
- Stream AI responses in real-time (Server-Sent Events)
- Auto-detect available Ollama models on startup
- Handle Ollama being offline gracefully
- Keep the UI focused on PM workflows, not developer workflows
