# Feature Requirements — Code Companion

## Four Analysis Modes

### 1. Explain Code
- User pastes code, gets plain-English explanation
- System prompt: "You are explaining code to a Product Manager. Use clear, non-technical language. Explain WHAT the code does, WHY it matters for the product, and flag any business implications."
- Output: Structured explanation with sections

### 2. Bug Hunter
- User pastes code, AI identifies potential bugs, security issues, edge cases
- System prompt: "You are a senior code reviewer helping a PM understand risks. For each issue found, explain: what the bug is, what could go wrong for users, and how severe it is (Low/Medium/High/Critical)."
- Output: Severity-tagged list of issues

### 3. Refactor
- User pastes code, gets improved version with explanation of changes
- System prompt: "You are a senior developer refactoring code. Show the improved version, then explain each change in plain English. Focus on readability, performance, and maintainability."
- Output: Improved code + change explanations

### 4. Translate (Tech ↔ Business)
- Two sub-modes:
  - **Tech → Business**: Paste technical spec/PR description → get business-friendly summary
  - **Business → Tech**: Describe a feature request → get technical requirements
- System prompt varies by direction

## Cross-Cutting Features
- **Model Selector**: Dropdown to pick which Ollama model to use
- **Streaming Responses**: Text appears word-by-word via SSE
- **Conversation History**: Past conversations saved as JSON, browsable in sidebar
- **Code Input**: Large textarea with monospace font, line numbers feel
- **Copy Output**: One-click copy of AI response
- **Clear/New**: Start fresh conversation

## Architecture
```
Browser (React) ←→ Express Server ←→ Ollama API (192.168.50.7:11424)
                         ↓
                    history/ (JSON files)
```

## Data Model — Conversation History
```json
{
  "id": "uuid",
  "mode": "explain",
  "model": "llama3",
  "createdAt": "2026-03-11T...",
  "title": "Auto-generated from first input",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```
