/**
 * Shared review orchestration for HTTP routes and agent builtins (AGENTSKILL).
 */

const { resolveAutoModel, mergeAutoModelMap } = require("./auto-model");
const { effectiveOllamaApiKey, ollamaAuthOpts } = require("./ollama-client");
const { reviewCode, reviewFiles } = require("./review");
const { loadValidateReviewContext } = require("./review-validate-context");

function validateReviewImages(images) {
  if (images == null) return { ok: true, images: [] };
  if (!Array.isArray(images))
    return { ok: false, error: "Images must be an array" };
  if (images.length > 10)
    return { ok: false, error: "Maximum 10 images per message" };
  return { ok: true, images };
}

function httpError(status, message) {
  const e = new Error(message);
  e.httpStatus = status;
  return e;
}

async function resolveReviewModel(reqModel, codeLength, config, log) {
  let model = reqModel;
  if (model === "auto") {
    try {
      const estimatedTokens = Math.ceil(codeLength / 3.5);
      const r = await resolveAutoModel({
        requestedModel: model,
        mode: "review",
        estimatedTokens,
        config,
        ollamaUrl: config.ollamaUrl,
        ollamaOpts: ollamaAuthOpts(config),
      });
      model = r.resolved;
      log("INFO", `Auto-model resolved: mode=review → ${model}`);
    } catch (err) {
      log("WARN", "Auto-model resolution failed (review)", {
        error: err.message,
      });
      const m = mergeAutoModelMap(config.autoModelMap);
      model = m.review || m.chat || "llama3.2";
    }
  }
  return model;
}

/**
 * Single-snippet review (same inputs as POST /api/review after field checks).
 * @param {{ config: object, log: Function, reqModel: string, code: string, filename?: string, images?: any[], abortSignal?: import('stream').AbortSignal }} p
 */
async function runReviewSnippetPhase(p) {
  const { config, log, reqModel, code, filename, images, abortSignal } = p;
  const v = validateReviewImages(images);
  if (!v.ok) throw httpError(400, v.error);

  const validateReviewContext = loadValidateReviewContext(
    config.projectFolder,
    { searchFrom: filename || "" },
  );

  const model = await resolveReviewModel(reqModel, code.length, config, log);
  const result = await reviewCode(config.ollamaUrl, model, code, {
    filename,
    timeoutSec: config.reviewTimeoutSec,
    images: v.images,
    validateContext: validateReviewContext?.context || "",
    numCtx: config.numCtx || 0,
    autoAdjustContext: config.autoAdjustContext,
    ollamaApiKey: effectiveOllamaApiKey(config),
    abortSignal,
  });
  return { model, result, reqModel };
}

/**
 * Folder review (same as POST /api/review/folder after path + file checks).
 */
async function runReviewFolderPhase(p) {
  const {
    config,
    log,
    reqModel,
    folder,
    files,
    totalSize,
    skipped,
    abortSignal,
  } = p;

  let model = reqModel;
  if (model === "auto") {
    try {
      const totalChars = files.reduce(
        (s, f) => s + (f.content?.length || 0),
        0,
      );
      const estimatedTokens = Math.ceil(totalChars / 3.5);
      const r = await resolveAutoModel({
        requestedModel: model,
        mode: "review",
        estimatedTokens,
        config,
        ollamaUrl: config.ollamaUrl,
        ollamaOpts: ollamaAuthOpts(config),
      });
      model = r.resolved;
      log("INFO", `Auto-model resolved: mode=review (folder) → ${model}`);
    } catch (err) {
      const m = mergeAutoModelMap(config.autoModelMap);
      model = m.review || m.chat || "llama3.2";
    }
  }

  const validateReviewContext = loadValidateReviewContext(
    config.projectFolder,
    { searchFrom: folder || "" },
  );

  const result = await reviewFiles(config.ollamaUrl, model, files, {
    timeoutSec: config.reviewTimeoutSec,
    validateContext: validateReviewContext?.context || "",
    numCtx: config.numCtx || 0,
    autoAdjustContext: config.autoAdjustContext,
    ollamaApiKey: effectiveOllamaApiKey(config),
    abortSignal,
  });

  return {
    model,
    result,
    reqModel,
    meta: { fileCount: files.length, totalSize, skipped, folder },
  };
}

module.exports = {
  validateReviewImages,
  resolveReviewModel,
  runReviewSnippetPhase,
  runReviewFolderPhase,
};
