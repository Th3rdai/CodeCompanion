const { chatStructured, chatStream } = require("./ollama-client");
const { ReportCardSchema, reportCardJsonSchema } = require("./review-schema");
const { SYSTEM_PROMPTS } = require("./prompts");

// ── Model-size-aware timeout ─────────────────────────

function getTimeoutForModel(model) {
  const name = (model || "").toLowerCase();

  // Check for size indicators in model name — 5 min max for all sizes
  if (/(?:^|[^0-9])(?:1b|3b)(?:$|[^0-9])/.test(name)) return 180000;
  if (/(?:^|[^0-9])(?:7b|8b)(?:$|[^0-9])/.test(name)) return 240000;
  if (/(?:^|[^0-9])(?:13b|14b)(?:$|[^0-9])/.test(name)) return 300000;
  if (/(?:^|[^0-9])(?:33b|34b|70b|72b|110b|405b)(?:$|[^0-9])/.test(name))
    return 300000;

  // Default timeout for unknown model sizes (5 minutes)
  return 300000;
}

// ── Review orchestration ─────────────────────────────

async function reviewCode(ollamaUrl, model, code, opts = {}) {
  const images = opts.images || [];

  // Inject vision-specific context when images are present
  const visionContext =
    images.length > 0
      ? `\n\nThe user has attached ${images.length} image(s) (e.g., code screenshots). Analyze them carefully in your review.`
      : "";

  const userContent = opts.filename
    ? `File: ${opts.filename}\n\nReview this code:\n\n\`\`\`\n${code}\n\`\`\`${visionContext}`
    : `Review this code:\n\n\`\`\`\n${code}\n\`\`\`${visionContext}`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPTS["review"] },
    { role: "user", content: userContent },
  ];

  const timeout =
    opts.timeoutMs ||
    (opts.timeoutSec ? opts.timeoutSec * 1000 : getTimeoutForModel(model));

  // Build Ollama options (num_ctx) with optional auto-adjustment
  let numCtx = opts.numCtx || 0;
  if (opts.autoAdjustContext) {
    const totalChars = messages.reduce(
      (sum, m) => sum + (m.content?.length || 0),
      0,
    );
    const estimatedTokens = Math.ceil(totalChars / 3.5) + 2048;
    if (estimatedTokens > numCtx) numCtx = Math.min(estimatedTokens, 524288);
  }
  const ollamaOptions = numCtx > 0 ? { num_ctx: numCtx } : {};
  if (opts.ollamaApiKey) ollamaOptions.apiKey = opts.ollamaApiKey;

  try {
    const raw = await chatStructured(
      ollamaUrl,
      model,
      messages,
      reportCardJsonSchema,
      timeout,
      images,
      ollamaOptions,
    );
    const validated = ReportCardSchema.parse(raw);
    return { type: "report-card", data: validated };
  } catch (err) {
    // Fallback to chat mode (locked decision from CONTEXT.md)
    const fallbackMessages = [
      { role: "system", content: SYSTEM_PROMPTS["review-fallback"] },
      {
        role: "user",
        content: `Review this code:\n\n\`\`\`\n${code}\n\`\`\`${visionContext}`,
      },
    ];
    const stream = await chatStream(
      ollamaUrl,
      model,
      fallbackMessages,
      images,
      ollamaOptions,
    );
    return { type: "chat-fallback", stream, error: err.message };
  }
}

async function reviewFiles(ollamaUrl, model, files, opts = {}) {
  const combined = files
    .map((f) => `// --- FILE: ${f.path} ---\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const baseTimeout =
    opts.timeoutMs ||
    (opts.timeoutSec ? opts.timeoutSec * 1000 : getTimeoutForModel(model));
  const timeout = Math.min(
    baseTimeout * Math.max(1, Math.ceil(files.length / 5)),
    600000,
  );

  const userPreamble =
    `Review this project across ALL files. When reporting findings, ` +
    `include the filename (e.g., "In auth.js: ...") so the developer ` +
    `knows exactly where to look.\n\n`;

  return reviewCode(ollamaUrl, model, userPreamble + combined, {
    ...opts,
    filename: `${files.length} files`,
    timeoutMs: timeout,
  });
}

module.exports = {
  reviewCode,
  reviewFiles,
  getTimeoutForModel,
};
