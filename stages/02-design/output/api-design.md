# API Design — Code Companion Server

## Express Endpoints

### GET /api/models
Proxy to Ollama GET /api/tags. Returns available models.

### POST /api/chat
Proxy to Ollama POST /api/chat with streaming via SSE.
Body: `{ model, messages, mode }`
Server injects the system prompt based on `mode`.
Response: SSE stream (`text/event-stream`).

### GET /api/history
Returns list of saved conversations (id, title, mode, model, date).

### GET /api/history/:id
Returns a single conversation with all messages.

### DELETE /api/history/:id
Deletes a conversation.

### POST /api/history
Saves/updates a conversation.
Body: full conversation object.

## SSE Streaming Flow
1. Frontend sends POST /api/chat
2. Server opens request to Ollama with `stream: true`
3. Server reads NDJSON chunks from Ollama
4. Server forwards each chunk as SSE `data:` event
5. On `done: true`, server sends `data: [DONE]`
6. Frontend accumulates tokens and renders progressively

## Static Files
Express serves `public/` directory for the frontend HTML.
