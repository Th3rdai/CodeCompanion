const { chatStructured, chatStream } = require('./ollama-client')
const { ReportCardSchema, reportCardJsonSchema } = require('./review-schema')
const { SYSTEM_PROMPTS } = require('./prompts')

// ── Model-size-aware timeout ─────────────────────────

function getTimeoutForModel(model) {
  const name = (model || '').toLowerCase()

  // Check for size indicators in model name — 5 min max for all sizes
  if (/(?:^|[^0-9])(?:1b|3b)(?:$|[^0-9])/.test(name)) return 180000
  if (/(?:^|[^0-9])(?:7b|8b)(?:$|[^0-9])/.test(name)) return 240000
  if (/(?:^|[^0-9])(?:13b|14b)(?:$|[^0-9])/.test(name)) return 300000
  if (/(?:^|[^0-9])(?:33b|34b|70b|72b|110b|405b)(?:$|[^0-9])/.test(name)) return 300000

  // Default timeout for unknown model sizes (5 minutes)
  return 300000
}

// ── Review orchestration ─────────────────────────────

async function reviewCode(ollamaUrl, model, code, opts = {}) {
  const userContent = opts.filename
    ? `File: ${opts.filename}\n\nReview this code:\n\n\`\`\`\n${code}\n\`\`\``
    : `Review this code:\n\n\`\`\`\n${code}\n\`\`\``

  const messages = [
    { role: 'system', content: SYSTEM_PROMPTS['review'] },
    { role: 'user', content: userContent }
  ]

  const timeout = opts.timeoutMs || (opts.timeoutSec ? opts.timeoutSec * 1000 : getTimeoutForModel(model))

  try {
    const raw = await chatStructured(ollamaUrl, model, messages, reportCardJsonSchema, timeout)
    const validated = ReportCardSchema.parse(raw)
    return { type: 'report-card', data: validated }
  } catch (err) {
    // Fallback to chat mode (locked decision from CONTEXT.md)
    const fallbackMessages = [
      { role: 'system', content: SYSTEM_PROMPTS['review-fallback'] },
      { role: 'user', content: `Review this code:\n\n\`\`\`\n${code}\n\`\`\`` }
    ]
    const stream = await chatStream(ollamaUrl, model, fallbackMessages)
    return { type: 'chat-fallback', stream, error: err.message }
  }
}

module.exports = {
  reviewCode,
  getTimeoutForModel
}
