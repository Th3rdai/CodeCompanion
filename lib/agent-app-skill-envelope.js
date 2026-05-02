/**
 * Pinned JSON envelopes for agent app-skill builtins (AGENTSKILL §5.0.1–5.0.2).
 */

/** @typedef {'TOOL_DISABLED'|'AUTH_FAILED'|'TIMEOUT'|'PATH_DENIED'|'MODEL_FAILED'|'INVALID_ARGS'|'RATE_LIMITED'} SkillErrorCode */

const SKILL_ERROR_CODES = Object.freeze({
  TOOL_DISABLED: "TOOL_DISABLED",
  AUTH_FAILED: "AUTH_FAILED",
  TIMEOUT: "TIMEOUT",
  PATH_DENIED: "PATH_DENIED",
  MODEL_FAILED: "MODEL_FAILED",
  INVALID_ARGS: "INVALID_ARGS",
  RATE_LIMITED: "RATE_LIMITED",
});

const AUDIT_PREFIX = "[SKILL_AUDIT]";

/** @param {(level: string, msg: string, data?: object) => void} log */
function emitSkillAudit(log, fields) {
  if (typeof log !== "function") return;
  const line = {
    skill: fields.skill,
    ok: fields.ok,
    model: fields.model ?? null,
    durationMs: fields.durationMs,
    truncated: fields.truncated ?? false,
    ...(fields.code ? { code: fields.code } : {}),
    ...(typeof fields.summaryChars === "number"
      ? { summaryChars: fields.summaryChars }
      : {}),
  };
  log("INFO", `${AUDIT_PREFIX} ${JSON.stringify(line)}`);
}

/**
 * @param {{ type: 'report-card'|'summary', data?: unknown, summary?: string, truncated: boolean, model: string, durationMs: number }} p
 */
function buildSuccessEnvelope(p) {
  const out = {
    ok: true,
    type: p.type,
    truncated: !!p.truncated,
    model: p.model,
    durationMs: p.durationMs,
  };
  if (p.type === "summary") out.summary = p.summary ?? "";
  else out.data = p.data;
  return out;
}

/**
 * @param {{ code: SkillErrorCode, message: string, hint?: string }} p
 */
function buildErrorEnvelope(p) {
  const out = { ok: false, code: p.code, message: p.message };
  if (p.hint) out.hint = p.hint;
  return out;
}

/**
 * @param {Error} err
 * @param {{ abortSignal?: AbortSignal }} [ctx]
 */
function mapExceptionToSkillError(err, ctx = {}) {
  const msg = (err && err.message) || String(err);
  const name = err && err.name;

  if (name === "AbortError" || ctx.abortSignal?.aborted) {
    return buildErrorEnvelope({
      code: SKILL_ERROR_CODES.TIMEOUT,
      message: "The operation was stopped or timed out.",
      hint: "Retry with a smaller input or check that Ollama is running.",
    });
  }

  if (/outside the configured project folder|Path is outside/i.test(msg)) {
    return buildErrorEnvelope({
      code: SKILL_ERROR_CODES.PATH_DENIED,
      message: msg,
      hint: "Use paths under the project folder from Settings.",
    });
  }

  if (/rate limit|429|too many requests/i.test(msg)) {
    return buildErrorEnvelope({
      code: SKILL_ERROR_CODES.RATE_LIMITED,
      message: msg,
    });
  }

  if (/401|403|unauthori|forbidden|authentication required/i.test(msg)) {
    return buildErrorEnvelope({
      code: SKILL_ERROR_CODES.AUTH_FAILED,
      message: msg,
      hint: "Check Ollama URL and API key in Settings.",
    });
  }

  if (
    /Ollama HTTP|Ollama error|fetch failed|ECONNREFUSED|MODEL_FAILED/i.test(msg)
  ) {
    return buildErrorEnvelope({
      code: SKILL_ERROR_CODES.MODEL_FAILED,
      message: msg,
      hint: "Verify the model name and that Ollama is reachable.",
    });
  }

  if (
    /Provide |Invalid mode|must be an array|Maximum 10|Missing|Set a project folder|sourcePath must|No scannable/i.test(
      msg,
    )
  ) {
    return buildErrorEnvelope({
      code: SKILL_ERROR_CODES.INVALID_ARGS,
      message: msg,
    });
  }

  return buildErrorEnvelope({
    code: SKILL_ERROR_CODES.MODEL_FAILED,
    message: msg,
  });
}

function toolDisabledEnvelope(skillKey, settingsHint) {
  return buildErrorEnvelope({
    code: SKILL_ERROR_CODES.TOOL_DISABLED,
    message: `${skillKey} is disabled in Settings.`,
    hint: settingsHint,
  });
}

module.exports = {
  SKILL_ERROR_CODES,
  buildSuccessEnvelope,
  buildErrorEnvelope,
  mapExceptionToSkillError,
  emitSkillAudit,
  toolDisabledEnvelope,
  SKILL_AUDIT_PREFIX: AUDIT_PREFIX,
};
