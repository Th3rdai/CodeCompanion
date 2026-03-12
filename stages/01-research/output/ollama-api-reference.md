# Ollama API Reference

## Base URL
`http://192.168.50.7:11424`

## Endpoints Used

### GET /api/tags
Returns list of available models.
Response: `{ "models": [{ "name": "llama3", "size": 4661224676, ... }] }`

### POST /api/chat (streaming)
Send a chat completion request with streaming.
```json
{
  "model": "llama3",
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "stream": true
}
```
Response: NDJSON stream, each line is:
```json
{ "message": { "role": "assistant", "content": "token" }, "done": false }
```
Final line has `"done": true` with stats.

### POST /api/chat (non-streaming)
Same as above but with `"stream": false`. Returns complete response at once.

## Error Handling
- Connection refused → Ollama not running
- 404 on model → Model not installed
- Timeout → Model loading or very long generation
