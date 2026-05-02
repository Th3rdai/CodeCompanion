/**
 * Shared builder-score orchestration for HTTP routes and agent builtins (AGENTSKILL §5.0).
 *
 * routes/score.js (HTTP/SSE wrapper) and lib/agent-app-skills.js#executeBuilderScore
 * both call runBuilderScorePhase so mode validation, auto-model resolution,
 * and the underlying scoreContent call only live once.
 */

const { resolveAutoModel, mergeAutoModelMap } = require("./auto-model");
const { ollamaAuthOpts } = require("./ollama-client");
const { scoreContent } = require("./builder-score");

const VALID_BUILDER_MODES = ["prompting", "skillz", "agentic", "planner"];

function httpError(status, message) {
  const e = new Error(message);
  e.httpStatus = status;
  return e;
}

async function resolveScoreModel(reqModel, mode, contentLength, config, log) {
  let model = reqModel;
  if (model === "auto") {
    try {
      const estimatedTokens = Math.ceil((contentLength || 0) / 3.5);
      const r = await resolveAutoModel({
        requestedModel: model,
        mode,
        estimatedTokens,
        config,
        ollamaUrl: config.ollamaUrl,
        ollamaOpts: ollamaAuthOpts(config),
      });
      model = r.resolved;
      log("INFO", `Auto-model resolved: mode=${mode} (score) → ${model}`);
    } catch (err) {
      log("WARN", `Auto-model resolution failed (score, mode=${mode})`, {
        error: err.message,
      });
      const m = mergeAutoModelMap(config.autoModelMap);
      model = m[mode] || m.chat || "llama3.2";
    }
  }
  return model;
}

/**
 * Run a builder score against the validated body of POST /api/score.
 *
 * @param {{ config: object, log: Function, reqModel: string, mode: string,
 *           content: string, metadata?: object }} p
 * @returns {Promise<{ model: string, result: object, reqModel: string }>}
 */
async function runBuilderScorePhase(p) {
  const { config, log, reqModel, mode, content, metadata } = p;
  if (!reqModel || !content || !mode) {
    throw httpError(400, "model, mode, and content are required");
  }
  if (!VALID_BUILDER_MODES.includes(mode)) {
    throw httpError(
      400,
      `Invalid mode. Must be one of: ${VALID_BUILDER_MODES.join(", ")}`,
    );
  }

  const model = await resolveScoreModel(
    reqModel,
    mode,
    content.length,
    config,
    log,
  );

  const result = await scoreContent(
    config.ollamaUrl,
    model,
    mode,
    content,
    metadata,
    ollamaAuthOpts(config),
  );
  return { model, result, reqModel };
}

module.exports = {
  VALID_BUILDER_MODES,
  resolveScoreModel,
  runBuilderScorePhase,
};
