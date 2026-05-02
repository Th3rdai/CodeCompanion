/**
 * Agent "app skills" — first-party Review / Pentest / Builder score from chat builtins (AGENTSKILL).
 */

const fs = require("fs");
const path = require("path");
const { runReviewSnippetPhase } = require("./review-service");
const {
  runPentestSnippetPhase,
  runPentestFolderPhase,
} = require("./pentest-service");
const { runBuilderScorePhase } = require("./score-service");
const { readFolderFiles, isWithinBasePath } = require("./file-browser");
const {
  buildSuccessEnvelope,
  buildErrorEnvelope,
  mapExceptionToSkillError,
  emitSkillAudit,
} = require("./agent-app-skill-envelope");

const MAX_FALLBACK_CHARS = 100_000;
const MAX_SOURCE_FILE_BYTES = 2 * 1024 * 1024;

function isAgentAppSkillEnabled(config, family) {
  const s = config.agentAppSkills || {};
  if (s.enabled !== true) return false;
  if (family === "review") return s.review === true;
  if (family === "pentest") return s.pentest === true;
  if (family === "builderScore") return s.builderScore === true;
  return false;
}

function validateImagesArray(images) {
  if (images == null) return { ok: true, images: [] };
  if (!Array.isArray(images))
    return { ok: false, error: "Images must be an array" };
  if (images.length > 10)
    return { ok: false, error: "Maximum 10 images per message" };
  return { ok: true, images };
}

function resolveProjectPath(config, relOrAbs) {
  const base = config.projectFolder || "";
  if (!base) throw new Error("Set a project folder in Settings first.");
  const abs = path.isAbsolute(relOrAbs)
    ? path.resolve(relOrAbs)
    : path.resolve(base, relOrAbs);
  if (!isWithinBasePath(base, abs))
    throw new Error("Path is outside the configured project folder.");
  return abs;
}

async function loadCodeFromArgs(args, config) {
  if (typeof args.code === "string" && args.code.trim().length > 0)
    return args.code;
  if (typeof args.sourcePath === "string" && args.sourcePath.trim()) {
    const abs = resolveProjectPath(config, args.sourcePath.trim());
    const st = fs.statSync(abs);
    if (!st.isFile()) throw new Error("sourcePath must be a file.");
    if (st.size > MAX_SOURCE_FILE_BYTES)
      throw new Error(
        `File too large for review builtin (max ${MAX_SOURCE_FILE_BYTES / (1024 * 1024)} MB).`,
      );
    return fs.readFileSync(abs, "utf8");
  }
  throw new Error(
    'Provide "code" (string) or "sourcePath" under the project folder.',
  );
}

async function consumeOllamaChatStream(stream, abortSignal) {
  if (!stream.ok) {
    const t = await stream.text();
    return {
      ok: false,
      text: `Ollama HTTP ${stream.status}: ${t.slice(0, 500)}`,
    };
  }
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  try {
    while (true) {
      if (abortSignal?.aborted) {
        await reader.cancel().catch(() => {});
        return { ok: false, text: out, aborted: true };
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t) continue;
        try {
          const parsed = JSON.parse(t);
          if (parsed.message?.content) {
            out += parsed.message.content;
            if (out.length > MAX_FALLBACK_CHARS) {
              out += "\n\n[truncated]";
              await reader.cancel().catch(() => {});
              return { ok: true, text: out, truncated: true };
            }
          }
        } catch {
          /* ignore bad line */
        }
      }
    }
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer);
        if (parsed.message?.content) out += parsed.message.content;
      } catch {
        /* ignore */
      }
    }
    return { ok: true, text: out };
  } catch (err) {
    return { ok: false, text: out, error: err.message };
  }
}

function skillTextResponse(envelope, success) {
  return {
    success,
    result: {
      content: [{ type: "text", text: JSON.stringify(envelope) }],
    },
  };
}

async function executeReviewRun(args, config, log, abortSignal) {
  const skill = "review_run";
  const t0 = Date.now();
  let resolvedModel = String(args.model || "").trim() || "auto";
  try {
    const code = await loadCodeFromArgs(args, config);
    const img = validateImagesArray(args.images);
    if (!img.ok) {
      const env = buildErrorEnvelope({
        code: "INVALID_ARGS",
        message: img.error,
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model: resolvedModel,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const { model, result } = await runReviewSnippetPhase({
      config,
      log,
      reqModel: resolvedModel,
      code,
      filename: args.filename,
      images: img.images,
      abortSignal,
    });
    resolvedModel = model;

    if (result.type === "report-card") {
      const env = buildSuccessEnvelope({
        type: "report-card",
        data: result.data,
        truncated: false,
        model,
        durationMs: Date.now() - t0,
      });
      emitSkillAudit(log, {
        skill,
        ok: true,
        model,
        durationMs: env.durationMs,
        truncated: false,
      });
      return skillTextResponse(env, true);
    }

    const streamed = await consumeOllamaChatStream(result.stream, abortSignal);
    if (streamed.aborted || abortSignal?.aborted) {
      const env = mapExceptionToSkillError(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
        { abortSignal },
      );
      emitSkillAudit(log, {
        skill,
        ok: false,
        model,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }
    if (streamed.ok === false) {
      const env = buildErrorEnvelope({
        code: "MODEL_FAILED",
        message: streamed.text || streamed.error || "Stream read failed",
        hint: "Try Review mode in the app for full streaming output.",
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const truncated = !!streamed.truncated;
    const env = buildSuccessEnvelope({
      type: "summary",
      summary: streamed.text || "",
      truncated,
      model,
      durationMs: Date.now() - t0,
    });
    emitSkillAudit(log, {
      skill,
      ok: true,
      model,
      durationMs: env.durationMs,
      truncated,
      summaryChars: (streamed.text || "").length,
    });
    return skillTextResponse(env, true);
  } catch (err) {
    const env = mapExceptionToSkillError(err, { abortSignal });
    emitSkillAudit(log, {
      skill,
      ok: false,
      model: resolvedModel,
      durationMs: Date.now() - t0,
      code: env.code,
    });
    return skillTextResponse(env, false);
  }
}

async function executePentestScan(args, config, log, abortSignal) {
  const skill = "pentest_scan";
  const t0 = Date.now();
  let resolvedModel = String(args.model || "").trim() || "auto";
  try {
    const code = await loadCodeFromArgs(args, config);
    const img = validateImagesArray(args.images);
    if (!img.ok) {
      const env = buildErrorEnvelope({
        code: "INVALID_ARGS",
        message: img.error,
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model: resolvedModel,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const phase = await runPentestSnippetPhase({
      config,
      log,
      reqModel: resolvedModel,
      code,
      filename: args.filename,
      images: img.images,
      abortSignal,
    });
    const model = phase.model;
    const result = phase.result;
    resolvedModel = model;

    if (result.type === "security-report") {
      const env = buildSuccessEnvelope({
        type: "report-card",
        data: result.data,
        truncated: false,
        model,
        durationMs: Date.now() - t0,
      });
      emitSkillAudit(log, {
        skill,
        ok: true,
        model,
        durationMs: env.durationMs,
        truncated: false,
      });
      return skillTextResponse(env, true);
    }

    const streamed = await consumeOllamaChatStream(result.stream, abortSignal);
    if (streamed.aborted || abortSignal?.aborted) {
      const env = mapExceptionToSkillError(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
        { abortSignal },
      );
      emitSkillAudit(log, {
        skill,
        ok: false,
        model,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }
    if (streamed.ok === false) {
      const env = buildErrorEnvelope({
        code: "MODEL_FAILED",
        message: streamed.text || streamed.error || "Stream read failed",
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const truncated = !!streamed.truncated;
    const env = buildSuccessEnvelope({
      type: "summary",
      summary: streamed.text || "",
      truncated,
      model,
      durationMs: Date.now() - t0,
    });
    emitSkillAudit(log, {
      skill,
      ok: true,
      model,
      durationMs: env.durationMs,
      truncated,
      summaryChars: (streamed.text || "").length,
    });
    return skillTextResponse(env, true);
  } catch (err) {
    const env = mapExceptionToSkillError(err, { abortSignal });
    emitSkillAudit(log, {
      skill,
      ok: false,
      model: resolvedModel,
      durationMs: Date.now() - t0,
      code: env.code,
    });
    return skillTextResponse(env, false);
  }
}

async function executePentestScanFolder(args, config, log, abortSignal) {
  const skill = "pentest_scan_folder";
  const t0 = Date.now();
  let resolvedModel = String(args.model || "").trim() || "auto";
  try {
    const folderRaw = String(args.folder || "").trim();
    if (!folderRaw) {
      const env = buildErrorEnvelope({
        code: "INVALID_ARGS",
        message: 'Provide "folder" (absolute or under project).',
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model: resolvedModel,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const base = config.projectFolder || "";
    if (!base) {
      const env = buildErrorEnvelope({
        code: "INVALID_ARGS",
        message: "Set a project folder in Settings first.",
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model: resolvedModel,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }
    const folderAbs = path.isAbsolute(folderRaw)
      ? path.resolve(folderRaw)
      : path.resolve(base, folderRaw);
    if (!isWithinBasePath(base, folderAbs)) {
      const env = buildErrorEnvelope({
        code: "PATH_DENIED",
        message: "Folder is outside the configured project folder.",
        hint: "Use a folder under the project root from Settings.",
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model: resolvedModel,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const { files, totalSize, skipped } = readFolderFiles(folderAbs, {
      maxFiles: 80,
      maxTotalSize: 2 * 1024 * 1024,
    });
    if (files.length === 0) {
      const env = buildErrorEnvelope({
        code: "INVALID_ARGS",
        message: "No scannable text files found in folder.",
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model: resolvedModel,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const phase = await runPentestFolderPhase({
      config,
      log,
      reqModel: resolvedModel,
      files,
      folder: folderAbs,
      totalSize,
      skipped,
      abortSignal,
    });
    const model = phase.model;
    const result = phase.result;
    resolvedModel = model;

    if (result.type === "security-report") {
      const env = buildSuccessEnvelope({
        type: "report-card",
        data: {
          ...result.data,
          _scanMeta: {
            fileCount: files.length,
            totalSize,
            skipped,
            folder: folderAbs,
          },
        },
        truncated: false,
        model,
        durationMs: Date.now() - t0,
      });
      emitSkillAudit(log, {
        skill,
        ok: true,
        model,
        durationMs: env.durationMs,
        truncated: false,
      });
      return skillTextResponse(env, true);
    }

    const streamed = await consumeOllamaChatStream(result.stream, abortSignal);
    if (streamed.aborted || abortSignal?.aborted) {
      const env = mapExceptionToSkillError(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
        { abortSignal },
      );
      emitSkillAudit(log, {
        skill,
        ok: false,
        model,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }
    if (streamed.ok === false) {
      const env = buildErrorEnvelope({
        code: "MODEL_FAILED",
        message: streamed.text || streamed.error || "Stream read failed",
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const truncated = !!streamed.truncated;
    const env = buildSuccessEnvelope({
      type: "summary",
      summary: streamed.text || "",
      truncated,
      model,
      durationMs: Date.now() - t0,
    });
    emitSkillAudit(log, {
      skill,
      ok: true,
      model,
      durationMs: env.durationMs,
      truncated,
      summaryChars: (streamed.text || "").length,
    });
    return skillTextResponse(env, true);
  } catch (err) {
    const env = mapExceptionToSkillError(err, { abortSignal });
    emitSkillAudit(log, {
      skill,
      ok: false,
      model: resolvedModel,
      durationMs: Date.now() - t0,
      code: env.code,
    });
    return skillTextResponse(env, false);
  }
}

async function executeBuilderScore(args, config, log, abortSignal) {
  const skill = "builder_score";
  const t0 = Date.now();
  let resolvedModel = String(args.model || "").trim() || "auto";
  try {
    const content = String(args.content || "").trim();
    if (!content) {
      const env = buildErrorEnvelope({
        code: "INVALID_ARGS",
        message: 'Provide "content" to score.',
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model: resolvedModel,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }
    const mode = String(args.mode || "").trim();
    const metadata =
      args.metadata && typeof args.metadata === "object" ? args.metadata : {};

    const phase = await runBuilderScorePhase({
      config,
      log,
      reqModel: resolvedModel,
      mode,
      content,
      metadata,
    });
    const model = phase.model;
    const result = phase.result;
    resolvedModel = model;

    if (result.type === "score-card") {
      const env = buildSuccessEnvelope({
        type: "report-card",
        data: result.data,
        truncated: false,
        model,
        durationMs: Date.now() - t0,
      });
      emitSkillAudit(log, {
        skill,
        ok: true,
        model,
        durationMs: env.durationMs,
        truncated: false,
      });
      return skillTextResponse(env, true);
    }

    const streamed = await consumeOllamaChatStream(result.stream, abortSignal);
    if (streamed.aborted || abortSignal?.aborted) {
      const env = mapExceptionToSkillError(
        Object.assign(new Error("aborted"), { name: "AbortError" }),
        { abortSignal },
      );
      emitSkillAudit(log, {
        skill,
        ok: false,
        model,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }
    if (streamed.ok === false) {
      const env = buildErrorEnvelope({
        code: "MODEL_FAILED",
        message: streamed.text || streamed.error || "Stream read failed",
      });
      emitSkillAudit(log, {
        skill,
        ok: false,
        model,
        durationMs: Date.now() - t0,
        code: env.code,
      });
      return skillTextResponse(env, false);
    }

    const truncated = !!streamed.truncated;
    const env = buildSuccessEnvelope({
      type: "summary",
      summary: streamed.text || "",
      truncated,
      model,
      durationMs: Date.now() - t0,
    });
    emitSkillAudit(log, {
      skill,
      ok: true,
      model,
      durationMs: env.durationMs,
      truncated,
      summaryChars: (streamed.text || "").length,
    });
    return skillTextResponse(env, true);
  } catch (err) {
    const env = mapExceptionToSkillError(err, { abortSignal });
    emitSkillAudit(log, {
      skill,
      ok: false,
      model: resolvedModel,
      durationMs: Date.now() - t0,
      code: env.code,
    });
    return skillTextResponse(env, false);
  }
}

module.exports = {
  isAgentAppSkillEnabled,
  executeReviewRun,
  executePentestScan,
  executePentestScanFolder,
  executeBuilderScore,
};
