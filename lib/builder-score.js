const { chatStructured, chatStream } = require("./ollama-client");
const { SCORE_SCHEMAS, scoreJsonSchemas } = require("./builder-schemas");
const { SYSTEM_PROMPTS } = require("./prompts");

// ── Model-size-aware timeout ─────────────────────────

function getTimeoutForModel(model) {
  const name = (model || "").toLowerCase();

  // Check for size indicators in model name
  if (/(?:^|[^0-9])(?:1b|3b)(?:$|[^0-9])/.test(name)) return 60000;
  if (/(?:^|[^0-9])(?:7b|8b)(?:$|[^0-9])/.test(name)) return 90000;
  if (/(?:^|[^0-9])(?:13b|14b)(?:$|[^0-9])/.test(name)) return 120000;
  if (/(?:^|[^0-9])(?:33b|34b|70b|72b|110b|405b)(?:$|[^0-9])/.test(name))
    return 180000;

  // Default timeout for unknown model sizes
  return 120000;
}

// ── Score orchestration ──────────────────────────────

/**
 * Score content for a builder mode (prompting, skillz, or agentic)
 * @param {string} ollamaUrl
 * @param {string} model
 * @param {string} mode - 'prompting' | 'skillz' | 'agentic'
 * @param {string} content - The content to score
 * @param {object} metadata - Optional metadata (purpose, variables, etc.)
 * @returns {{ type: 'score-card', data: object } | { type: 'chat-fallback', stream, error }}
 */
async function scoreContent(
  ollamaUrl,
  model,
  mode,
  content,
  metadata = {},
  ollamaOpts = {},
) {
  const schema = SCORE_SCHEMAS[mode];
  const jsonSchema = scoreJsonSchemas[mode];

  if (!schema || !jsonSchema) {
    throw new Error(`Unknown builder mode: ${mode}`);
  }

  // Build user message with content and optional metadata
  let userContent = `Score this content:\n\n${content}`;
  if (metadata && Object.keys(metadata).length > 0) {
    userContent += `\n\nMetadata:\n${JSON.stringify(metadata, null, 2)}`;
  }

  const messages = [
    { role: "system", content: SYSTEM_PROMPTS[mode] },
    { role: "user", content: userContent },
  ];

  const timeout = getTimeoutForModel(model);

  try {
    const raw = await chatStructured(
      ollamaUrl,
      model,
      messages,
      jsonSchema,
      timeout,
      [],
      ollamaOpts,
    );
    const validated = schema.parse(raw);
    return { type: "score-card", data: validated };
  } catch (err) {
    // Fallback to chat mode
    const fallbackMessages = [
      { role: "system", content: SYSTEM_PROMPTS[mode + "-fallback"] },
      { role: "user", content: `Score this content:\n\n${content}` },
    ];
    const stream = await chatStream(
      ollamaUrl,
      model,
      fallbackMessages,
      [],
      ollamaOpts,
    );
    return { type: "chat-fallback", stream, error: err.message };
  }
}

module.exports = {
  scoreContent,
  getTimeoutForModel,
};
