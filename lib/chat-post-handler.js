const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { getConfig } = require("../lib/config");
const { SYSTEM_PROMPTS } = require("../lib/prompts");
const {
  chatStream,
  chatComplete,
  ollamaAuthOpts,
  summarizeOllamaFail,
  parseOllamaErrMsg,
  formatUserOllamaChatError,
} = require("../lib/ollama-client");
const {
  resolveAutoModel,
  mergeAutoModelMap,
  demoteModel,
  isCloudModelName,
} = require("../lib/auto-model");
const { formatBrandAssetsPrompt } = require("../lib/brand-context");
const { formatHostTimeForPrompt } = require("../lib/host-time");
const { estimateMessageTokens } = require("./context-budget.js");
const { buildFileTree } = require("../lib/file-browser");
const {
  buildMemoryContext,
  resolveEmbeddingModel,
  deriveProjectKey,
} = require("../lib/memory");
const { STREAM_INTERNAL_ERROR } = require("../lib/client-errors");
const {
  userRequestedBrowserSnapshot,
  needsSnapshotRetry,
} = require("../lib/browser-intent");
const {
  generateReqSuffix,
  maybeExternalizeToolOutput,
  gcOlderThan: gcToolResultsOlderThan,
} = require("../lib/tool-result-artifacts");

/** Avoid re-walking the project tree on every chat (large repos were blocking the event loop). */
const PROJECT_PROMPT_CACHE_TTL_MS = 60_000;
let _projectPromptCache = { folder: "", at: 0, prompt: "" };

/** Default planning files injected into the system prompt when found in the project folder. */
const DEFAULT_PROJECT_CONTEXT_FILES = [
  "CONTEXT.md",
  "TASK.md",
  ".planning/STATE.md",
  "INITIAL.md",
];
const PROJECT_CONTEXT_MAX_CHARS = 8000;
const TOOL_RESULTS_FINALIZER_MAX_CHARS = 30000;
const BROWSER_CONTENT_FINALIZER_MIN_CHARS = 4000;
const SERVER_ATTACHED_FILES_TOTAL_CHAR_CAP = 180000;

function buildEmptyAssistantReplyMessage(model) {
  const modelLabel = model || "the selected model";
  return (
    `I did not get any text back from ${modelLabel}. ` +
    "The request reached Code Companion and Ollama, but the model returned an empty completion. " +
    "Please try again, or switch from Auto to another model for this request."
  );
}

function stripAgentToolsPrompt(content = "") {
  return content
    .replace(/\n\n---\nAGENT IDENTITY OVERRIDE[\s\S]*$/, "")
    .replace(/\n\n---\nAGENT TOOLS[\s\S]*$/, "");
}

function appendCappedToolResults(existing, addition, maxChars) {
  if (!addition || !addition.trim()) return existing;
  const next = existing ? `${existing}\n\n${addition.trim()}` : addition.trim();
  if (next.length <= maxChars) return next;
  return `${next.slice(0, maxChars)}\n\n...(additional tool results omitted after ${maxChars} chars)`;
}

/** Builtins often return { success:false, result:{content:[{text}]}} with no `error` — avoid "failed: undefined". */
function formatToolFailureMessage(result) {
  const err = result?.error;
  if (err != null && String(err).trim()) return String(err).trim();
  const parts = result?.result?.content || [];
  const text = parts
    .filter((c) => c && c.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n")
    .trim();
  if (text) return text;
  return "(no error details)";
}

function latestUserText(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg?.role === "user" && typeof msg.content === "string") {
      return msg.content;
    }
  }
  return "";
}

// Strip the appended "ATTACHED FILES:" block (and its content/code fences) from
// a user message so that intent regexes only match the user's actual request,
// not arbitrary text that happens to be inside attached PDFs / files.
//
// The frontend builds the user message as:
//   <user prompt>
//   \n---\nATTACHED FILES:\n
//   ### filename.pdf (filename.pdf)\n
//   ```\n<converted markdown>\n```\n
//
// Without this strip, a benign prompt like "summarize this pdf" can flip
// `userLikelyRequestedActionableToolWork` to true because the attached PDF
// content naturally contains words like "run", "check", "create", "file" —
// which then forces a tool-call corrective retry and triggers the meta-response
// cascade (2026-05-05 minimax-m2:cloud incident, second-order).
function stripAttachedFileBlock(text = "") {
  const s = String(text || "");
  if (!s) return s;
  // Look for the most distinctive marker first.
  const markers = [
    /\n[-=_*]{2,}\s*\n\s*ATTACHED FILES:/i,
    /\n\s*ATTACHED FILES:/i,
    // Some clients use simpler headers
    /\n\s*###\s+[^\n]*\.(pdf|docx|xlsx|pptx|csv|odt|ods|odp|md|markdown|html|json|txt|epub|tex|latex)\b/i,
  ];
  for (const re of markers) {
    const idx = s.search(re);
    if (idx >= 0) return s.slice(0, idx).replace(/\s+$/, "");
  }
  return s;
}

// Server-side safety net: if a request still includes an extremely large
// ATTACHED FILES payload (for example from older clients or bypassed UI flows),
// cap the attached block so model context does not explode.
function capAttachedFileBlock(
  text = "",
  maxChars = SERVER_ATTACHED_FILES_TOTAL_CHAR_CAP,
) {
  const s = String(text || "");
  if (!s || maxChars <= 0) return s;
  const markers = [
    /\n[-=_*]{2,}\s*\n\s*ATTACHED FILES:/i,
    /\n\s*ATTACHED FILES:/i,
    /\n\s*###\s+[^\n]*\.(pdf|docx|xlsx|pptx|csv|odt|ods|odp|md|markdown|html|json|txt|epub|tex|latex)\b/i,
  ];
  let markerIdx = -1;
  for (const re of markers) {
    markerIdx = s.search(re);
    if (markerIdx >= 0) break;
  }
  if (markerIdx < 0) return s;
  const prefix = s.slice(0, markerIdx);
  const attached = s.slice(markerIdx);
  if (attached.length <= maxChars) return s;
  return (
    prefix +
    attached.slice(0, maxChars) +
    `\n\n...(attached file content truncated server-side after ${maxChars} chars)`
  );
}

function latestUserPrompt(messages = []) {
  return stripAttachedFileBlock(latestUserText(messages));
}

function userRequestedBrowserContentAnswer(messages = []) {
  const text = latestUserPrompt(messages).toLowerCase();
  const asksForContent =
    /\b(summarize|summarise|summary|headlines?|today'?s news|news|read|extract|what'?s on|what is on|visible content)\b/i.test(
      text,
    );
  const browserTarget =
    /\b(news\.google\.com|https?:\/\/|browser|navigate|open|web(?:site)?|page|url)\b/i.test(
      text,
    );
  return asksForContent && browserTarget;
}

function userLikelyRequestedActionableToolWork(messages = []) {
  const text = latestUserPrompt(messages).toLowerCase();
  if (!text) return false;
  const asksToDoSomething =
    /\b(add|change|check|create|delete|diagnose|edit|execute|fix|install|modify|open|ping|read|remove|replace|run|set up|setup|test|troubleshoot|update|validate|verify|write)\b/i.test(
      text,
    );
  if (!asksToDoSomething) return false;
  const includesPathOrToolTarget =
    /\/[\w./-]+|[\w.-]+\.(html|js|jsx|ts|tsx|json|md|css|png|jpg|jpeg|svg)\b|\b(file|folder|directory|terminal|command|shell|browser|favicon|index\.html|package\.json|readme|mcp|server|tool|tools|connectivity|connection|comms|health[_\s-]?check)\b/i.test(
      text,
    );
  return includesPathOrToolTarget;
}

function userExplicitlyDisallowsFileWrites(messages = []) {
  const text = latestUserPrompt(messages).toLowerCase();
  if (!text) return false;
  // Require a forbid cue near a concrete file-target noun.
  // Bare verbs like "don't write" or "no save" are too easy to false-positive on
  // ("don't write a long preamble", "no need to save this output"), so we always
  // require an explicit file-format/target word.
  return /\b(do not|don't|dont|no|without)\b[^.!?]{0,80}\b(file|files|docx|pdf|xlsx|pptx|csv|odt|ods|odp|to disk|on disk|to file)\b/i.test(
    text,
  );
}

// True when the user's prompt clearly asks for a file artefact (save, export,
// generate a document, "as report.pdf", etc.). When config.chatRequireExplicitFileWrites
// is true, Chat mode blocks file-writing builtins unless this returns true (or the
// user explicitly forbids writes — see userExplicitlyDisallowsFileWrites).
function userExplicitlyRequestsFileWrites(messages = []) {
  const text = latestUserPrompt(messages).toLowerCase();
  if (!text) return false;
  // Pattern A: action verb near a concrete file-target noun within 80 chars.
  if (
    /\b(save|export|generate|create|write|make|produce|build|output)\b[^.!?]{0,80}\b(file|files|docx|pdf|xlsx|pptx|csv|odt|ods|odp|md|markdown|html|json|txt|to disk|on disk|to file|document|report|attachment)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  // Pattern B: explicit filename with extension after a save/export verb.
  if (
    /\b(save|export|write|name|store)\b[^.!?]{0,40}\.(pdf|docx|xlsx|pptx|csv|odt|ods|odp|md|markdown|html|json|txt)\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return false;
}

// Build a deterministic signature for a list of tool calls so we can detect
// when the model emits the same tool with the same args twice in a row after a
// prior successful execution (a known Gemma/llava failure mode that produces
// duplicated file writes). Pure helper — no side effects.
function computeToolCallSignature(toolCalls = []) {
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return "";
  return toolCalls
    .map((call) => {
      let argsKey = "";
      try {
        argsKey = JSON.stringify(call?.args || {});
      } catch {
        argsKey = String(call?.args || "");
      }
      return `${call?.serverId || ""}.${call?.toolName || ""}:${argsKey}`;
    })
    .join(" | ");
}

function looksLikeNarratedActionWithoutToolCall(responseText = "") {
  const text = String(responseText || "");
  if (!text.trim()) return false;
  const narrationCue =
    /\b(let me|i(?:'|’)ll|i will|step\s*\d+|first[,:\s]|then[,:\s]|next[,:\s])\b/i.test(
      text,
    );
  const actionCue =
    /\b(add|change|check|create|delete|edit|execute|modify|open|read|remove|run|update|write)\b/i.test(
      text,
    );
  return narrationCue && actionCue;
}

/** Split a single shell line into command + args (whitespace only; no quoting). */
function parseShellWordsForPromotion(line = "") {
  const parts = String(line || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return null;
  return { command: parts[0], args: parts.slice(1) };
}

const _AUTO_PROMOTE_DANGEROUS_SUBSTR = /[;&|`\n\r]|\$\(|\$\{|\$\s/;
const _AUTO_PROMOTE_BLOCKED_CMD = new Set(
  [
    "sudo",
    "su",
    "doas",
    "rm",
    "rmdir",
    "shred",
    "curl",
    "wget",
    "eval",
    "exec",
    "ssh",
    "scp",
    "sftp",
    "dd",
    "mkfs",
    "mount",
    "umount",
    "chmod",
    "chown",
    "chgrp",
  ].map((s) => s.toLowerCase()),
);

function shellLineFailsAutoPromotionSafety(line = "") {
  const t = String(line || "").trim();
  if (!t || t.length > 800) return true;
  if (_AUTO_PROMOTE_DANGEROUS_SUBSTR.test(t)) return true;
  const parsed = parseShellWordsForPromotion(t);
  if (!parsed) return true;
  if (!/^[a-zA-Z0-9_.-]+$/.test(parsed.command)) return true;
  if (_AUTO_PROMOTE_BLOCKED_CMD.has(parsed.command.toLowerCase())) return true;
  return false;
}

/**
 * When the model narrates a shell command (fences, `$`, backticks, or a bare
 * ls/cat/... line) but omits TOOL_CALL, synthesize a leading TOOL_CALL line so
 * the existing executor runs `builtin.run_terminal_cmd` without a retry loop.
 * Conservative: one line, no shell metacharacters, blocklisted binaries.
 * @returns {string|null} Full assistant text with TOOL_CALL prepended, or null.
 */
function tryPromoteNarratedShellToToolCall(responseText = "") {
  const text = String(responseText || "");
  if (!text.trim() || /TOOL_CALL:/i.test(text)) return null;

  const candidates = [];

  const fenceRe = /```(?:bash|sh|shell|zsh)?\s*\n([\s\S]*?)```/gi;
  let m;
  while ((m = fenceRe.exec(text)) !== null) {
    const inner = m[1].trim();
    const firstLine = inner
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean);
    if (firstLine) candidates.push(firstLine);
  }

  const dollarRe = /^\s*\$\s+([^\n]+)$/gm;
  while ((m = dollarRe.exec(text)) !== null) {
    candidates.push(m[1].trim());
  }

  const backtickRe = /`([^`\n]+)`/g;
  while ((m = backtickRe.exec(text)) !== null) {
    const inner = m[1].trim();
    if (/^[a-zA-Z]/.test(inner) && inner.split(/\s+/).length <= 24) {
      candidates.push(inner);
    }
  }

  if (
    /\b(let me|i(?:'|’)ll|i will|checking|here(?:'|’)?s the command)\b/i.test(
      text,
    )
  ) {
    for (const line of text.split(/\n/)) {
      const s = line.trim();
      if (
        s.length > 0 &&
        s.length < 400 &&
        /^(?:ls|cat|pwd|head|tail|wc|git|find|grep|du|df|stat|file)\b/.test(s)
      ) {
        candidates.push(s);
      }
    }
  }

  for (const cand of candidates) {
    if (shellLineFailsAutoPromotionSafety(cand)) continue;
    const parsed = parseShellWordsForPromotion(cand);
    if (!parsed) continue;
    const payload = JSON.stringify({
      command: parsed.command,
      args: parsed.args,
    });
    const toolLine = `TOOL_CALL: builtin.run_terminal_cmd(${payload})`;
    return `${toolLine}\n\n${text}`;
  }
  return null;
}

function looksLikePermissionGateDeflection(responseText = "") {
  const text = String(responseText || "");
  if (!text.trim()) return false;
  return /\b(one tool at a time|wait for (?:each|the) tool result|cannot queue (?:up )?multiple tool calls|you can say ["“]?(?:continue|keep going)["”]?|say ["“]?(?:continue|keep going)["”]?|need (?:your )?permission before (?:running|calling)|let me run (?:a|the) .*?(?:now|next))/i.test(
    text,
  );
}

function looksLikeFileWritePolicyMetaResponse(responseText = "") {
  const text = String(responseText || "");
  if (!text.trim()) return false;
  return /\b(chat mode does not write files|do not write files unless the user explicitly asks|explicitly asks for a file artefact|this is (?:a )?safety feature|if you (?:later )?decide you want .*?(?:markdown|pdf|docx)|ask(?:ed)? .*?explicit(?:ly)? permission to create a file)\b/i.test(
    text,
  );
}

function hasUsefulBrowserContent(toolResults = "") {
  return (
    toolResults.length >= BROWSER_CONTENT_FINALIZER_MIN_CHARS &&
    /Tool builtin\.(?:browse_url|browser_snapshot|browser_scroll) returned:\s*\nPage:/i.test(
      toolResults,
    )
  );
}

function getCachedProjectPrompt(projectFolder) {
  if (!projectFolder || !fs.existsSync(projectFolder)) return "";
  const now = Date.now();
  if (
    _projectPromptCache.folder === projectFolder &&
    now - _projectPromptCache.at < PROJECT_PROMPT_CACHE_TTL_MS
  ) {
    return _projectPromptCache.prompt;
  }
  try {
    const { tree } = buildFileTree(projectFolder, 3);
    function flattenTree(nodes, prefix = "") {
      const lines = [];
      for (const n of nodes || []) {
        if (n.type === "file") lines.push(prefix + n.path);
        else lines.push(...flattenTree(n.children, prefix));
      }
      return lines;
    }
    const fileList = flattenTree(tree);
    if (fileList.length === 0) {
      _projectPromptCache = { folder: projectFolder, at: now, prompt: "" };
      return "";
    }
    let prompt = `\n\n---\nPROJECT FOLDER: ${projectFolder}\nFiles available (user can attach any of these for you to read):\n${fileList.slice(0, 200).join("\n")}${fileList.length > 200 ? `\n... and ${fileList.length - 200} more` : ""}`;

    // Inject planning file contents for dynamic project state awareness
    const config = getConfig();
    const contextFiles =
      Array.isArray(config.projectContextFiles) &&
      config.projectContextFiles.length > 0
        ? config.projectContextFiles
        : DEFAULT_PROJECT_CONTEXT_FILES;
    let contextBlock = "";
    for (const relPath of contextFiles) {
      try {
        const full = path.join(projectFolder, relPath);
        if (fs.existsSync(full) && fs.statSync(full).isFile()) {
          const content = fs.readFileSync(full, "utf8").trim();
          if (content) {
            contextBlock += `\n### ${relPath}\n${content}\n`;
          }
        }
      } catch (_) {}
    }
    if (contextBlock) {
      if (contextBlock.length > PROJECT_CONTEXT_MAX_CHARS) {
        contextBlock =
          contextBlock.slice(0, PROJECT_CONTEXT_MAX_CHARS) + "\n...(truncated)";
      }
      prompt += `\n\nPROJECT CONTEXT (from planning files — use this to understand current project state):\n${contextBlock}`;
    }

    _projectPromptCache = { folder: projectFolder, at: now, prompt };
    return prompt;
  } catch {
    return "";
  }
}

const pendingConfirmations = new Map();
const TOOL_CALL_RELIABILITY_STATS = {
  actionableRequests: 0,
  correctiveRetries: 0,
  fallbackAttempts: 0,
  fallbackSuccesses: 0,
  hardBlocks: 0,
};

function recordToolCallReliability(log, event, details = {}) {
  if (
    Object.prototype.hasOwnProperty.call(TOOL_CALL_RELIABILITY_STATS, event)
  ) {
    TOOL_CALL_RELIABILITY_STATS[event] += 1;
  }
  log("INFO", "Tool-call reliability event", {
    event,
    ...details,
    stats: { ...TOOL_CALL_RELIABILITY_STATS },
  });
}

async function handleChatPost(req, res, appContext) {
  const { log, debug, logDir, toolCallHandler } = appContext;
  const {
    model: reqModel,
    messages,
    mode,
    images,
    conversationId,
    agentMaxRounds,
    forceToolOnly,
  } = req.body;

  if (!reqModel || !messages || !mode) {
    log("ERROR", "Chat request missing fields", {
      model: !!reqModel,
      messages: !!messages,
      mode: !!mode,
    });
    return res.status(400).json({ error: "Missing model, messages, or mode" });
  }

  let model = reqModel;

  // Validate images array if present
  if (images && !Array.isArray(images)) {
    log("ERROR", "Images must be an array");
    return res.status(400).json({ error: "Images must be an array" });
  }
  if (images && images.length > 10) {
    log("WARN", `Too many images: ${images.length}`, { limit: 10 });
    return res.status(400).json({ error: "Maximum 10 images per message" });
  }

  const systemPrompt = SYSTEM_PROMPTS[mode];
  if (!systemPrompt) {
    log("ERROR", `Unknown mode: ${mode}`);
    return res.status(400).json({ error: `Unknown mode: ${mode}` });
  }

  toolCallHandler._experimentToolPolicy =
    mode === "experiment" ? "strict" : null;
  toolCallHandler._experimentId = null;
  toolCallHandler._experimentScope = null;
  if (mode === "experiment") {
    try {
      const { getActiveExperimentByProject } = require("./experiment-store");
      const cfgNow = getConfig();
      const active = getActiveExperimentByProject(cfgNow.projectFolder);
      if (active) {
        toolCallHandler._experimentId = active.id;
        toolCallHandler._experimentScope = active.scope || null;
      } else if (req.body?._experimentId) {
        toolCallHandler._experimentId = String(req.body._experimentId);
      }
    } catch (e) {
      log("WARN", "Failed to look up active experiment scope", {
        error: e.message,
      });
    }
  }
  const clearExperimentPolicy = () => {
    toolCallHandler._experimentToolPolicy = null;
    toolCallHandler._experimentId = null;
    toolCallHandler._experimentScope = null;
  };
  res.once("close", clearExperimentPolicy);
  res.once("finish", clearExperimentPolicy);

  // CTXFIX Phase 3 — fire-and-forget GC of stale tool-result artifacts.
  // Best-effort: failures swallowed inside gcOlderThan. Runs once per
  // chat request (cheap because the directory is small) so the user
  // never has to think about cleanup.
  const _scheduleToolResultsGc = () => {
    const folder = String(getConfig().projectFolder || "").trim();
    if (!folder) return;
    setImmediate(() => {
      try {
        gcToolResultsOlderThan(folder);
      } catch {
        // best-effort
      }
    });
  };
  res.once("close", _scheduleToolResultsGc);
  res.once("finish", _scheduleToolResultsGc);

  log(
    "INFO",
    `Chat request: model=${model} mode=${mode} messages=${messages.length}`,
    {
      imageCount: images?.length || 0,
    },
  );

  const config = getConfig();

  // CTXFIX Phase 3 — per-request artifacts for the tool-output cap.
  // The counter is owned by THIS handler (sole writer);
  // maybeExternalizeToolOutput only reads `.value` for the threshold check.
  const cumulativeRef = { value: 0 };
  const reqSuffix = generateReqSuffix();

  let memoryPrompt = "";
  let memoryMeta = null;

  const totalCharsEstimate = messages.reduce(
    (s, m) => s + (typeof m.content === "string" ? m.content.length : 0),
    0,
  );
  const estimatedTokensPre = Math.ceil(totalCharsEstimate / 3.5);
  const hasImages = images && images.length > 0;

  const embModel = resolveEmbeddingModel(config);
  const memoryConvId =
    typeof conversationId === "string" && conversationId.trim()
      ? conversationId.trim()
      : null;
  // Derive project key from active folder (chatFolder takes priority over projectFolder)
  const memoryProjectKey = deriveProjectKey(
    config.chatFolder || config.projectFolder || null,
  );
  const memoryPromise = config.memory?.enabled
    ? buildMemoryContext(
        config.ollamaUrl,
        embModel,
        messages,
        config,
        memoryConvId,
        memoryProjectKey,
      ).catch((err) => {
        log("WARN", "Memory retrieval failed, proceeding without", {
          error: err.message,
        });
        return { prompt: "", memories: null };
      })
    : Promise.resolve({ prompt: "", memories: null });

  let wasAutoResolved = false;

  if (model === "auto") {
    wasAutoResolved = true;
    try {
      const [r, memCtx] = await Promise.all([
        resolveAutoModel({
          requestedModel: model,
          mode,
          estimatedTokens: estimatedTokensPre,
          config,
          ollamaUrl: config.ollamaUrl,
          ollamaOpts: ollamaAuthOpts(config),
          preferVision: hasImages,
          preferToolCapable:
            mode === "experiment" ||
            config.agentTerminal?.enabled === true ||
            toolCallHandler.hasExternalMcpTools(),
          // Auto-bump to a bigger-context model when the conversation can't fit.
          minContextTokens: estimatedTokensPre,
        }),
        memoryPromise,
      ]);
      model = r.resolved;
      memoryPrompt = memCtx.prompt || "";
      memoryMeta = memCtx.memories;
      log("INFO", `Auto-model resolved: mode=${mode} → ${model}`);
      if (r.contextOverflow) {
        log(
          "WARN",
          `Auto-model: no model with sufficient context for ~${estimatedTokensPre} tokens — using ${model} which may truncate`,
        );
        sendEvent({
          notice: {
            kind: "context_overflow",
            estimatedTokens: estimatedTokensPre,
            resolvedModel: model,
            message: `No installed model has enough context for this conversation (~${estimatedTokensPre} tokens). Using ${model}; output may truncate.`,
          },
        });
      }
    } catch (err) {
      log("WARN", "Auto-model resolution failed", { error: err.message });
      const m = mergeAutoModelMap(config.autoModelMap);
      model = m[mode] || m.chat || "llama3.2";
      const memCtx = await memoryPromise;
      memoryPrompt = memCtx.prompt || "";
      memoryMeta = memCtx.memories;
    }
  } else {
    const memCtx = await memoryPromise;
    memoryPrompt = memCtx.prompt || "";
    memoryMeta = memCtx.memories;
  }

  // Append brand assets context if configured (shared helper — see lib/brand-context.js).
  const brandPrompt = formatBrandAssetsPrompt(config.brandAssets);

  // Inject chat folder context (the active project, may differ from the broader projectFolder access root).
  // When images are attached, suppress the project file tree / planning content so a small vision model
  // (e.g. llava:7b) doesn't anchor its image description on the surrounding textual project context.
  const projectPrompt = hasImages
    ? ""
    : getCachedProjectPrompt(config.chatFolder || config.projectFolder);

  // Set client key for intra-request terminal rate limiting
  toolCallHandler.clientKey =
    req.ip || req.connection?.remoteAddress || "unknown";

  // Append agent tool descriptions (MCP clients + builtin tools)
  const {
    prompt: toolsPrompt,
    hasTerminalTool,
    hasBrowserTool,
    hasCrawl4aiResearchTools,
  } = toolCallHandler.getToolsPromptAndFlags();
  const hasAgentTools = toolsPrompt.length > 0;

  // Date/time grounding — host clock (local civil date + time + TZ + ISO instant).
  // Kept as a separate variable so the agent-tools branch below cannot clobber it.
  const dateContext = formatHostTimeForPrompt();

  // Prepend factual capability statements before the persona prompt.
  // Include both browser and terminal capability lines when both are available.
  let leadIn = dateContext;
  if (hasAgentTools) {
    leadIn +=
      "CAPABILITY: This agent session has access to executable tools via MCP/builtin integrations. Use TOOL_CALL to execute them directly when relevant — do not ask the user to run tools manually.\n";
    if (hasTerminalTool) {
      leadIn +=
        "CAPABILITY: Terminal execution is available via builtin.run_terminal_cmd (project-folder scoped).\n";
      leadIn +=
        "RULE: To run any shell command you MUST emit a TOOL_CALL line (see tool list). Do not rely on markdown code fences, backticks, lines like `$ ls`, <tool_code> tags, or ```tool_code``` fences alone — those are not executed. Prefer one TOOL_CALL then wait for the tool result.\n";
    }
    if (hasBrowserTool) {
      leadIn += hasCrawl4aiResearchTools
        ? "CAPABILITY: Browser automation is available via browser_* (e.g. browser_navigate/browser_snapshot) for interactive pages and rendered snapshots. For **web search** or **fetch/summarize from URLs**, prefer Crawl4AI MCP tools (search_web, crawl_website, extract_content) when listed in the tool list — not Playwright unless the user needs a real driven browser.\n"
        : "CAPABILITY: Browser automation is available via browser_* tools (for example browser_navigate/browser_snapshot). For website open/snapshot requests, execute those tools directly.\n";
    }
    leadIn += "\n";
  }

  // Inject vision-specific prompt when images are present.
  // Hoisted before project/memory/tools context so small vision models (llava:7b) anchor on the actual
  // pixels rather than surrounding textual context (file names, planning docs, memory snippets).
  const visionPrompt = hasImages
    ? `\n\n---\nIMAGES: The user has attached ${images.length} image(s) directly to this message. Your task is to describe and analyze ONLY what is visible in the attached image(s). Do NOT describe or reference the project folder, file lists, or any other context unless the image itself clearly shows them. If you cannot read text in the image, say so — do not substitute information from elsewhere.`
    : "";

  // Do not inject other conversations' summaries here — each thread keeps its own context via `messages` + scoped memory.

  const enrichedSystemPrompt =
    leadIn +
    systemPrompt +
    visionPrompt +
    brandPrompt +
    projectPrompt +
    memoryPrompt +
    toolsPrompt;

  if (hasAgentTools) {
    debug("Agent tools injected into system prompt", {
      toolsLength: toolsPrompt.length,
    });
  }

  // Strip base64 image data from message history — prevents 400 errors on cloud models
  // Images were already rendered client-side; AI doesn't need megabytes of base64 in follow-ups
  const BASE64_IMG_RE =
    /!\[([^\]]*)\]\(data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}\)/g;
  const cleanedMessages = messages.map((m, i) => {
    // Strip client-side tool-context marker — not a real Ollama field
    const { _toolContext, ...mClean } = m;
    const isLastUserMsg = i === messages.length - 1 && mClean.role === "user";
    let cleaned = mClean;
    // Strip base64 markdown images
    if (
      m.content &&
      typeof m.content === "string" &&
      BASE64_IMG_RE.test(m.content)
    ) {
      cleaned = {
        ...cleaned,
        content: cleaned.content.replace(
          BASE64_IMG_RE,
          "[earlier image was shown to user]",
        ),
      };
    }
    // Strip images arrays from historical messages — only keep on current message
    // so non-vision models don't get 400 errors from Ollama
    if (Array.isArray(m.images) && m.images.length > 0 && !isLastUserMsg) {
      const { images: _dropped, ...rest } = cleaned;
      cleaned = {
        ...rest,
        content:
          (rest.content || "") + "\n[User previously shared an image here]",
      };
    }
    // Server-side cap for oversized attached-file text blocks.
    if (cleaned.role === "user" && typeof cleaned.content === "string") {
      const capped = capAttachedFileBlock(cleaned.content);
      if (capped !== cleaned.content) {
        cleaned = { ...cleaned, content: capped };
      }
    }
    return cleaned;
  });

  // If client already sent a system message (e.g. review deep-dive), use it instead of the default
  const clientHasSystem = cleanedMessages.some((m) => m.role === "system");
  const fullMessages = clientHasSystem
    ? cleanedMessages.map((m) =>
        m.role === "system"
          ? {
              role: "system",
              content:
                leadIn +
                m.content +
                brandPrompt +
                projectPrompt +
                memoryPrompt +
                toolsPrompt +
                visionPrompt,
            }
          : m,
      )
    : [{ role: "system", content: enrichedSystemPrompt }, ...cleanedMessages];

  // ── Compute Ollama options (num_ctx, timeout) with auto-adjustment ──
  // `let` so Phase 2 (server-side history compaction) can recompute after
  // rewriting fullMessages. Phase 1a is behavior-preserving; the formula is
  // shared with the client preflight via src/lib/context-budget.js.
  let estimatedTokens = estimateMessageTokens(fullMessages);
  // Cloud-hosted Ollama models reject `num_ctx` with a 500 — context size is
  // fixed server-side and the option only applies to locally-loaded models.
  const isCloud = isCloudModelName(model);
  let effectiveNumCtx = isCloud ? 0 : config.numCtx || 0;
  let effectiveTimeoutMs = (config.chatTimeoutSec || 600) * 1000;

  if (config.autoAdjustContext && estimatedTokens > 4096) {
    if (!isCloud) {
      // Auto-boost num_ctx to fit content with headroom for response (~2K tokens)
      const needed = estimatedTokens + 2048;
      if (needed > effectiveNumCtx) {
        effectiveNumCtx = Math.min(needed, 524288); // cap at 512K
        log(
          "INFO",
          `Auto-adjusted num_ctx to ${effectiveNumCtx} (content ~${estimatedTokens} tokens)`,
        );
      }
    }
    // Auto-boost timeout for large contexts: +60s per 32K tokens beyond 8K
    if (estimatedTokens > 8192) {
      const extraSec = Math.ceil((estimatedTokens - 8192) / 32768) * 60;
      effectiveTimeoutMs = Math.max(
        effectiveTimeoutMs,
        (120 + extraSec) * 1000,
      );
      effectiveTimeoutMs = Math.min(effectiveTimeoutMs, 600000); // cap at 10 min
    }
  }
  const ollamaOptions = {
    ...(effectiveNumCtx > 0 ? { num_ctx: effectiveNumCtx } : {}),
    ...ollamaAuthOpts(config),
  };

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const chatAbortController = new AbortController();
  req.on("close", () => {
    chatAbortController.abort();
  });

  // Helper: send SSE event
  function sendEvent(data) {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Send memory context metadata before streaming tokens
  if (memoryMeta?.length > 0) {
    sendEvent({
      memoryContext: {
        count: memoryMeta.length,
        items: memoryMeta.map((m) => ({ type: m.type, content: m.content })),
      },
    });
  }

  if (reqModel === "auto") {
    sendEvent({ resolvedModel: model });
  }

  try {
    debug("Calling Ollama chat", {
      url: config.ollamaUrl,
      model,
      hasAgentTools,
    });

    // ── Tool-call loop (when agent tools are available) ──
    // Set up SSE streaming context so builtin tools (e.g. run_terminal_cmd) can
    // stream live output and request user confirmation.
    const stripAnsiSimple = (s) => s.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");
    toolCallHandler.sseContext = {
      logDir,
      abortSignal: chatAbortController.signal,
      onStart: (info) => sendEvent({ terminalCmd: info }),
      onData: (chunk) => {
        const text = stripAnsiSimple(chunk.toString());
        if (text) sendEvent({ terminalOutput: text });
      },
      onStatus: (info) => sendEvent({ terminalStatus: info }),
      confirmCallback: config.agentTerminal?.confirmBeforeRun
        ? ({ command, args, cwd }) => {
            const id = crypto.randomUUID();
            return new Promise((resolve) => {
              const timeout = setTimeout(() => {
                pendingConfirmations.delete(id);
                resolve({ approved: false });
              }, 60000);
              pendingConfirmations.set(id, { resolve, timeout });
              sendEvent({ confirmRequired: { id, command, args, cwd } });
            });
          }
        : null,
    };

    // Use chatComplete for rounds that may contain tool calls, then stream the final response.
    if (hasAgentTools) {
      let loopMessages = [...fullMessages];
      const forceToolOnlyForTurn = forceToolOnly === true;
      if (forceToolOnlyForTurn) {
        loopMessages.push({
          role: "user",
          content:
            "Recovery mode: this request previously stalled. Output exactly one executable TOOL_CALL when an action is needed, and do not narrate steps without calling a tool.",
        });
        sendEvent({
          notice: {
            kind: "tool_call_recovery_mode",
            message:
              "Recovery mode enabled for this turn: enforcing tool-first behavior.",
          },
        });
      }
      const MAX_ROUNDS = Math.min(
        Math.max(parseInt(agentMaxRounds) || 10, 1),
        25,
      );
      let finalText = "";
      const toolContextForHistory = []; // text-only tool rounds — emitted to client for history persistence
      let browserDeflectionRetryUsed = false;
      let browserContinuationRetries = 0;
      const MAX_BROWSER_CONTINUATION_RETRIES = 3;
      let lastRoundHadBrowserTool = false;
      let accumulatedToolResults = "";
      const snapshotRequested = userRequestedBrowserSnapshot(messages);
      const browserContentAnswerRequested =
        userRequestedBrowserContentAnswer(messages);
      const browserDeflectionPattern =
        /(cannot|can't|unable to|don't have (?:the )?capability).{0,180}(browser|playwright).{0,180}(execute|run|automation)|would need to.{0,180}(script|manually|environment)/i;
      const browserCorrectionMessage =
        "Browser automation tools are available in this session. The user asked for website navigation/snapshot actions. Do not refuse or ask for manual scripts. Use TOOL_CALL with browser_* tools now (e.g. browser_navigate, then browser_snapshot), then report actual results.";
      const actionableToolIntent =
        userLikelyRequestedActionableToolWork(messages);
      let genericNoToolCallRetries = 0;
      const MAX_GENERIC_NO_TOOL_CALL_RETRIES = 2;
      let toolReliabilityFallbackTried = false;
      let toolReliabilityFallbackSucceeded = false;
      // Auto-mode self-heal across rounds: when a cloud model returns an
      // opaque 500 (`ref:<uuid>`), demote it and retry the round with a
      // different model rather than bouncing the error back to the user.
      const triedOpaqueModels = new Set();
      let opaqueRetryAttempts = 0;
      const MAX_OPAQUE_RETRIES = 2;
      const genericNoToolCallCorrectionMessage =
        "The user asked for an actionable task, but you did not emit an executable tool call. Output exactly one TOOL_CALL now and nothing else. Do not narrate steps. Do not put commands only inside markdown fences, backticks, <tool_code> tags, or ```tool_code``` fences — the line must start with TOOL_CALL:";
      let permissionDeflectionRetries = 0;
      const MAX_PERMISSION_DEFLECTION_RETRIES = 2;
      const permissionDeflectionCorrectionMessage =
        "Do not ask the user to say 'continue', do not claim you can only call one tool at a time, and do not ask permission. You can emit TOOL_CALL now. Output exactly one executable TOOL_CALL and nothing else.";
      let fileWriteMetaRetries = 0;
      const MAX_FILE_WRITE_META_RETRIES = 2;
      const fileWriteMetaCorrectionMessage =
        "Do not explain file-write policy, safety rules, or permissions. The blocked file-write attempt is already handled. Continue by answering the user's original request directly in chat now using available context. Do not ask for permission and do not ask follow-up unless truly blocked.";
      let hasExecutedToolCall = false;
      let lastToolCallSignature = "";
      // Chat-protocol auto-continue: optionally re-prompt with "continue" when
      // the model emits prose without an explicit completion signal, so
      // multi-step work doesn't stall at the turn boundary. Applies to any
      // mode that flows through this handler (chat, explain, refactor, bugs,
      // translate-tech, translate-biz, etc.). Modes with their own loops
      // (Build/Create/Agentic) use separate endpoints and aren't affected.
      // Off by default; gated by Settings → autoContinue.enabled.
      const autoContinueEnabled = config.autoContinue?.enabled === true;
      const autoContinueMaxSteps = Math.min(
        Math.max(parseInt(config.autoContinue?.maxSteps) || 5, 1),
        25,
      );
      let autoContinueSteps = 0;
      // "Done" detection: explicit completion phrases anywhere in the prose
      // OR a clear question/handoff to the user (those should also stop).
      const looksDone = (text) => {
        const t = String(text || "").toLowerCase();
        if (!t.trim()) return true; // empty prose — nothing to continue from
        if (
          /\btask[_ ]complete\b|\ball done\b|\beverything (?:is )?(?:set up|ready|complete|done)\b|\bsuccessfully (?:completed|finished|deployed|set up)\b|\bfinal answer\b|\bno further action\b|\bnothing (?:else|more) to do\b/i.test(
            t,
          )
        )
          return true;
        // Direct question to the user — stop and wait for their answer.
        if (/\?\s*$/.test(t.trim()) && t.length < 800) return true;
        return false;
      };
      const disallowFileWrites = userExplicitlyDisallowsFileWrites(messages);
      const explicitFileWriteRequest =
        userExplicitlyRequestsFileWrites(messages);
      const chatStrictFileWrites =
        config.chatRequireExplicitFileWrites === true;
      const chatModeImplicitDisallow =
        mode === "chat" && chatStrictFileWrites && !explicitFileWriteRequest;
      const fileWritesBlocked = disallowFileWrites || chatModeImplicitDisallow;
      let hasBlockedFileWriteTool = false;
      const blockedFileWriteCorrectionMessage = disallowFileWrites
        ? "The user explicitly said not to generate/save files. Do NOT call builtin.generate_office_file or builtin.write_file again in this turn. Either call a non-writing tool (for example builtin.view_pdf_pages or builtin.review_run with sourcePath) or provide the in-chat review directly. Output exactly one executable TOOL_CALL (or final prose only if no tool is needed)."
        : "Chat mode: respond in chat, do not write files unless the user explicitly asks for a file. Do NOT call builtin.generate_office_file or builtin.write_file. Provide the answer directly in chat. If the user wants a file, they will say so (e.g. 'save this as a markdown file', 'export to PDF').";
      const blockedFileWriteToolErrorMessage = disallowFileWrites
        ? "Blocked by user instruction: do not generate/save files for this request. Use non-writing analysis tools (for example builtin.review_run with sourcePath) or provide an in-chat review response."
        : "Blocked: chat mode does not write files unless the user explicitly asks for a file artefact. Provide the answer directly in chat. If the user wants a file, they will say so explicitly (e.g. 'save as a markdown file', 'export to PDF').";
      const isForbiddenFileWriteCall = (call) =>
        fileWritesBlocked &&
        call?.serverId === "builtin" &&
        (call?.toolName === "write_file" ||
          call?.toolName === "generate_office_file");
      if (fileWritesBlocked) {
        loopMessages.push({
          role: "user",
          content:
            blockedFileWriteCorrectionMessage +
            "\n\nDo not call file-writing tools first and then apologize. Continue the task with non-writing tools when needed, or answer directly in chat.",
        });
      }
      if (actionableToolIntent) {
        recordToolCallReliability(log, "actionableRequests", {
          mode,
          requestModel: reqModel,
        });
      }

      async function generateFinalTextFromToolResults(reason, opts = {}) {
        log("WARN", reason);
        const { roundLimitHit = false, roundsUsed = 0 } = opts;
        try {
          const finalizerMessages = fullMessages.map((m) =>
            m.role === "system"
              ? { ...m, content: stripAgentToolsPrompt(m.content) }
              : m,
          );
          const limitNote = roundLimitHit
            ? `IMPORTANT: You used all ${roundsUsed} of your tool-call rounds for this turn. Start your reply with one short sentence telling the user this — e.g. "I hit the tool-call round limit (${roundsUsed}) for this turn, so here is what I found before stopping." Then give the best answer you can from the actual results below. If commands were denied (shell metacharacters like &&, ;, |, redirects), name a couple specifically and tell the user to either retry without shell features or raise Settings → Agent → Max Rounds. `
            : "";
          finalizerMessages.push({
            role: "user",
            content:
              limitNote +
              "Do not call any tools. Based only on the actual tool results gathered below, answer the user's original request now. " +
              "If the task is incomplete, provide the best partial answer and briefly explain what blocked completion. " +
              "Only include a limitations, errors, or 'what did not work' section when the tool results show an actual error, blocked page, missing content, or incomplete task. " +
              "Do not claim that extraction, summarization, or analysis failed when you can answer from the captured page text.\n\n" +
              accumulatedToolResults,
          });

          const finalizerText = await chatComplete(
            config.ollamaUrl,
            model,
            finalizerMessages,
            effectiveTimeoutMs,
            [],
            {
              ...ollamaOptions,
              abortSignal: chatAbortController.signal,
            },
          );
          const firstToolIdx = finalizerText.indexOf("TOOL_CALL:");
          return firstToolIdx >= 0
            ? finalizerText.slice(0, firstToolIdx).trim()
            : finalizerText;
        } catch (err) {
          if (!chatAbortController.signal.aborted) {
            log("ERROR", "Tool-result finalizer failed", {
              error: err.message,
            });
          }
          return "";
        }
      }

      for (let round = 0; round < MAX_ROUNDS; round++) {
        debug(`Tool-call round ${round + 1}/${MAX_ROUNDS}`);

        if (chatAbortController.signal.aborted || res.writableEnded) {
          log("INFO", "Chat aborted (client disconnected) during tool loop");
          if (!res.writableEnded) {
            res.write("data: [DONE]\n\n");
            res.end();
          }
          return;
        }

        // Client-visible progress: chatComplete can take many minutes with zero
        // tokens on the wire — Experiment/chat UIs otherwise look frozen.
        sendEvent({
          modelWait: {
            round: round + 1,
            maxRounds: MAX_ROUNDS,
            message: `Round ${round + 1} of ${MAX_ROUNDS}: waiting for the model…`,
          },
        });
        let heartbeatTimer = setInterval(() => {
          if (chatAbortController.signal.aborted || res.writableEnded) return;
          sendEvent({
            heartbeat: true,
            waitRound: round + 1,
            waitMaxRounds: MAX_ROUNDS,
          });
        }, 20000);

        let responseText;
        let transientRetryAttempts = 0;
        const MAX_TRANSIENT_RETRIES = 1;
        const isTransientChatError = (errMsg) => {
          const m = String(errMsg || "").toLowerCase();
          return (
            m.includes("fetch failed") ||
            m.includes("econnreset") ||
            m.includes("etimedout") ||
            m.includes("socket hang up") ||
            m.includes("ehostunreach") ||
            m.includes("enetunreach") ||
            /\b(502|503|504)\b/.test(m)
          );
        };
        // Retry loop: recover from transient Ollama hiccups (fetch failed,
        // ECONNRESET, 5xx) without killing a multi-step turn. Bounded to
        // MAX_TRANSIENT_RETRIES retries then falls through to the existing
        // user-facing error path. AbortError and 4xx errors are NOT retried.
        try {
          while (true) {
            try {
              responseText = await chatComplete(
                config.ollamaUrl,
                model,
                loopMessages,
                effectiveTimeoutMs,
                images || [],
                {
                  ...ollamaOptions,
                  abortSignal: chatAbortController.signal,
                },
              );
              break;
            } catch (err) {
              if (
                err.name === "AbortError" ||
                chatAbortController.signal.aborted
              ) {
                throw err;
              }
              if (
                isTransientChatError(err.message) &&
                transientRetryAttempts < MAX_TRANSIENT_RETRIES
              ) {
                transientRetryAttempts++;
                log(
                  "WARN",
                  `Transient Ollama error on round ${round + 1} — retrying (${transientRetryAttempts}/${MAX_TRANSIENT_RETRIES}) in 1s`,
                  { error: err.message },
                );
                sendEvent({
                  notice: {
                    kind: "ollama_transient_retry",
                    attempt: transientRetryAttempts,
                    maxAttempts: MAX_TRANSIENT_RETRIES,
                    round: round + 1,
                    message: `Upstream model hiccup — retrying (${transientRetryAttempts}/${MAX_TRANSIENT_RETRIES})…`,
                  },
                });
                await new Promise((r) => setTimeout(r, 1000));
                continue;
              }
              throw err;
            }
          }
        } catch (err) {
          if (err.name === "AbortError" || chatAbortController.signal.aborted) {
            log(
              "INFO",
              `Chat aborted during chatComplete (round ${round + 1})`,
            );
            if (!res.writableEnded) {
              res.write("data: [DONE]\n\n");
              res.end();
            }
            return;
          }
          log("ERROR", `Ollama chatComplete failed (round ${round + 1})`, {
            error: err.message,
          });
          // Phase 6: Vision-specific error messages + parsed Ollama JSON body when present.
          const msg = err.message.toLowerCase();
          if (msg.includes("timeout") || msg.includes("timed out")) {
            sendEvent({
              error:
                images?.length > 0
                  ? "Request timed out. Vision models can take longer - try fewer images."
                  : "Request timed out. Try a shorter message or fewer images.",
            });
          } else {
            const parsed = parseOllamaErrMsg(err.message);
            const totalLen = loopMessages.reduce(
              (sum, m) => sum + (m.content?.length || 0),
              0,
            );
            const detail =
              parsed.detail ||
              (parsed.status === 0 ? String(err.message || "").trim() : "");
            // Auto-mode self-heal: when a cloud model returns an opaque 500
            // ("ref: <uuid>"), demote it for ~1h so the next auto resolution
            // picks something else.
            const cloudOpaque500 =
              parsed.status === 500 &&
              /ref:\s*[0-9a-f-]{8,}/i.test(detail) &&
              wasAutoResolved &&
              isCloudModelName(model);
            if (cloudOpaque500) {
              demoteModel(model, "cloud_opaque_500");
              triedOpaqueModels.add(model);
              log(
                "WARN",
                `Cloud model ${model} returned opaque 500; demoted for this session.`,
                { detail: detail.slice(0, 300) },
              );

              // Try to swap in a different auto model and retry this round
              // transparently rather than surfacing the error to the user.
              if (opaqueRetryAttempts < MAX_OPAQUE_RETRIES) {
                let next = null;
                try {
                  next = await resolveAutoModel({
                    requestedModel: "auto",
                    mode,
                    estimatedTokens,
                    config,
                    ollamaUrl: config.ollamaUrl,
                    ollamaOpts: ollamaAuthOpts(config),
                    preferVision: hasImages,
                    preferToolCapable:
                      mode === "experiment" ||
                      config.agentTerminal?.enabled === true ||
                      toolCallHandler.hasExternalMcpTools(),
                    excludeModels: Array.from(triedOpaqueModels),
                  });
                } catch (resolveErr) {
                  log("WARN", "Auto-retry resolution failed after opaque 500", {
                    error: resolveErr.message,
                  });
                }

                if (
                  next &&
                  next.resolved &&
                  !triedOpaqueModels.has(next.resolved)
                ) {
                  const fromModel = model;
                  model = next.resolved;
                  opaqueRetryAttempts++;
                  if (isCloudModelName(model) && ollamaOptions.num_ctx) {
                    delete ollamaOptions.num_ctx;
                  }
                  log(
                    "INFO",
                    `Auto-retry after cloud opaque 500 (round ${round + 1}): ${fromModel} → ${model} (attempt ${opaqueRetryAttempts}/${MAX_OPAQUE_RETRIES})`,
                  );
                  sendEvent({
                    notice: {
                      kind: "cloud_model_demoted",
                      fromModel,
                      toModel: model,
                      reason: "cloud_opaque_500",
                      autoRetry: true,
                      attempt: opaqueRetryAttempts,
                      maxAttempts: MAX_OPAQUE_RETRIES,
                      message: `${fromModel} hit a cloud error — auto-retrying with ${model}.`,
                    },
                  });
                  sendEvent({ resolvedModel: model });
                  round--; // retry this round with the new model (finally clears heartbeat)
                  continue;
                }
              }

              sendEvent({
                notice: {
                  kind: "cloud_model_demoted",
                  model,
                  reason: "cloud_opaque_500",
                  message: `${model} returned an opaque cloud error and was demoted for this session. Retry the message — auto mode will pick a different model.`,
                },
              });
            }
            sendEvent({
              error: formatUserOllamaChatError({
                status: parsed.status,
                detail,
                totalChars: totalLen,
                log,
              }),
            });
          }
          res.write("data: [DONE]\n\n");
          return res.end();
        } finally {
          clearInterval(heartbeatTimer);
        }

        // Check for tool calls
        debug("Ollama response (first 500 chars)", {
          text: responseText.substring(0, 500),
        });
        let toolCalls = toolCallHandler.parseToolCalls(responseText);
        if (toolCalls.length === 0 && hasTerminalTool && actionableToolIntent) {
          const promoted = tryPromoteNarratedShellToToolCall(responseText);
          if (promoted) {
            log("INFO", "Promoted narrated shell to TOOL_CALL", {
              preview: promoted.slice(0, 200),
            });
            responseText = promoted;
            toolCalls = toolCallHandler.parseToolCalls(responseText);
          }
        }

        // Guardrail: enforce max 1 builtin browser tool per round so the model
        // sees each result before deciding the next action.
        if (hasBrowserTool) {
          const BROWSER_TOOL_SET = new Set([
            "browse_url",
            "browser_snapshot",
            "browser_click",
            "browser_type",
            "browser_scroll",
          ]);
          let firstSeen = false;
          let discarded = 0;
          const kept = [];
          for (const call of toolCalls) {
            const isBrowser =
              call.serverId === "builtin" &&
              BROWSER_TOOL_SET.has(call.toolName);
            if (isBrowser && !firstSeen) {
              firstSeen = true;
              kept.push(call);
            } else if (isBrowser) {
              discarded++;
            } else {
              kept.push(call);
            }
          }
          if (discarded > 0) {
            log(
              "WARN",
              `Discarded ${discarded} extra browser tool call(s) — only 1 per round allowed`,
            );
            toolCalls.splice(0, toolCalls.length, ...kept);
          }
        }

        // Guardrail: if user asked for a snapshot but model emitted browser_* calls
        // without browser_snapshot, force-add browser_snapshot before execution.
        if (
          hasBrowserTool &&
          snapshotRequested &&
          needsSnapshotRetry(toolCalls)
        ) {
          const firstBrowserCall = toolCalls.find((c) =>
            /^browser_/i.test(c.toolName || ""),
          );
          if (firstBrowserCall) {
            toolCalls.push({
              serverId: firstBrowserCall.serverId,
              toolName: "browser_snapshot",
              args: {},
            });
          }
          log(
            "WARN",
            "Detected browser tool-call round without browser_snapshot; appended synthetic browser_snapshot call",
          );
        }

        // Guardrail: stop duplicate tool loops (same tool+args repeated after prior
        // successful execution). This prevents repeated side effects like repeated
        // generate_office_file/write_file calls when the model gets stuck.
        const currentToolCallSignature = computeToolCallSignature(toolCalls);
        if (
          hasExecutedToolCall &&
          currentToolCallSignature &&
          currentToolCallSignature === lastToolCallSignature
        ) {
          finalText = await generateFinalTextFromToolResults(
            "Detected repeated identical tool call signature after prior execution; finalizing from accumulated results instead of re-running side effects",
          );
          if (!finalText || !finalText.trim()) {
            finalText =
              "I’m stopping here to avoid repeating the same tool action again. I already have enough results to continue, so please tell me if you want a direct summary from the extracted output.";
          }
          break;
        }

        // If a file-writing tool was already blocked for this request, immediately
        // force a non-writing pivot before any repeat write/generate execution.
        if (
          hasBlockedFileWriteTool &&
          toolCalls.some((call) => isForbiddenFileWriteCall(call))
        ) {
          sendEvent({
            notice: {
              kind: "tool_call_retry",
              message:
                "Blocked file-write tool was requested again; forcing non-writing tool pivot.",
            },
          });
          log(
            "WARN",
            "Detected repeated forbidden file-writing tool after prior block; forcing corrective retry",
          );
          const firstToolIdx = responseText.indexOf("TOOL_CALL:");
          const cleanedResponse =
            firstToolIdx >= 0
              ? responseText.slice(0, firstToolIdx).trim()
              : responseText;
          if (cleanedResponse) {
            loopMessages.push({ role: "assistant", content: cleanedResponse });
          }
          loopMessages.push({
            role: "user",
            content: blockedFileWriteCorrectionMessage,
          });
          continue;
        }

        if (toolCalls.length === 0) {
          if (
            actionableToolIntent &&
            hasBlockedFileWriteTool &&
            looksLikeFileWritePolicyMetaResponse(responseText) &&
            fileWriteMetaRetries < MAX_FILE_WRITE_META_RETRIES
          ) {
            fileWriteMetaRetries++;
            sendEvent({
              notice: {
                kind: "tool_call_retry",
                retry: fileWriteMetaRetries,
                maxRetries: MAX_FILE_WRITE_META_RETRIES,
                message:
                  "The model explained file-write policy instead of continuing the task. Retrying with direct-answer instructions.",
              },
            });
            log(
              "WARN",
              `File-write policy meta response detected; corrective retry ${fileWriteMetaRetries}/${MAX_FILE_WRITE_META_RETRIES}`,
            );
            loopMessages.push({ role: "assistant", content: responseText });
            loopMessages.push({
              role: "user",
              content: fileWriteMetaCorrectionMessage,
            });
            continue;
          }

          if (
            actionableToolIntent &&
            looksLikePermissionGateDeflection(responseText) &&
            permissionDeflectionRetries < MAX_PERMISSION_DEFLECTION_RETRIES
          ) {
            permissionDeflectionRetries++;
            sendEvent({
              notice: {
                kind: "tool_call_retry",
                retry: permissionDeflectionRetries,
                maxRetries: MAX_PERMISSION_DEFLECTION_RETRIES,
                message:
                  "The model asked for manual 'continue' or permission instead of executing a tool call. Retrying automatically.",
              },
            });
            log(
              "WARN",
              `Permission/continue deflection detected; corrective retry ${permissionDeflectionRetries}/${MAX_PERMISSION_DEFLECTION_RETRIES}`,
            );
            loopMessages.push({ role: "assistant", content: responseText });
            loopMessages.push({
              role: "user",
              content:
                permissionDeflectionCorrectionMessage +
                '\n\nExample:\nTOOL_CALL: builtin.run_terminal_cmd({"command":"ls","args":["-la"]})',
            });
            continue;
          }

          // Guardrail: some models still deflect ("can't execute browser automation")
          // despite available Playwright/MCP browser tools. Give exactly one corrective
          // retry before treating the response as final text.
          if (
            hasBrowserTool &&
            !browserDeflectionRetryUsed &&
            browserDeflectionPattern.test(responseText)
          ) {
            browserDeflectionRetryUsed = true;
            log(
              "WARN",
              "Detected browser-tool deflection; injecting corrective retry",
            );
            loopMessages.push({ role: "assistant", content: responseText });
            loopMessages.push({
              role: "user",
              content: browserCorrectionMessage,
            });
            continue;
          }

          // Guardrail: if the previous round successfully ran a browser tool and the model
          // returned text without a tool call, it likely described the next step instead of
          // executing it. Retry up to MAX_BROWSER_CONTINUATION_RETRIES times.
          if (
            hasBrowserTool &&
            lastRoundHadBrowserTool &&
            browserContinuationRetries < MAX_BROWSER_CONTINUATION_RETRIES
          ) {
            browserContinuationRetries++;
            log(
              "WARN",
              `Browser task in progress but no tool call emitted — continuation retry ${browserContinuationRetries}/${MAX_BROWSER_CONTINUATION_RETRIES}`,
            );
            loopMessages.push({ role: "assistant", content: responseText });
            loopMessages.push({
              role: "user",
              content: `You described the next step but did not call the tool. Output a TOOL_CALL now and nothing else. Examples:\n\nTOOL_CALL: builtin.browser_click({"selector": "button[type=submit]"})\nTOOL_CALL: builtin.browser_click({"text": "Continue"})\nTOOL_CALL: builtin.browser_type({"selector": "#password", "text": "secret"})\nTOOL_CALL: builtin.browser_snapshot({})\n\nCall one now.`,
            });
            continue;
          }

          // If we already executed at least one tool call successfully in this turn,
          // accept the model's prose response as the final answer instead of forcing
          // additional TOOL_CALL retries. This prevents retry spirals where the model
          // keeps creating files/side effects after completing the main action.
          if (actionableToolIntent && hasExecutedToolCall) {
            // Auto-continue (Chat mode + Settings toggle): if the model returned
            // prose that doesn't signal completion and we haven't hit the cap,
            // re-prompt with "continue" so multi-step work keeps progressing
            // without the user having to send another message.
            if (
              autoContinueEnabled &&
              autoContinueSteps < autoContinueMaxSteps &&
              !looksDone(responseText)
            ) {
              autoContinueSteps++;
              log(
                "INFO",
                `Auto-continue: re-prompting (${autoContinueSteps}/${autoContinueMaxSteps}) — model returned prose without a completion signal`,
              );
              sendEvent({
                notice: {
                  kind: "auto_continue",
                  step: autoContinueSteps,
                  maxSteps: autoContinueMaxSteps,
                  message: `Auto-continue ${autoContinueSteps}/${autoContinueMaxSteps}: continuing without user input.`,
                },
              });
              loopMessages.push({
                role: "assistant",
                content: responseText,
              });
              loopMessages.push({
                role: "user",
                content:
                  "Continue with the next step of the task. Do not stop until the work is fully complete. " +
                  "When everything is genuinely done, end your reply with the literal token TASK_COMPLETE on its own line. " +
                  "If you truly need user input to proceed, end with a single direct question — otherwise keep going by emitting the next TOOL_CALL.",
              });
              continue;
            }
            log(
              "INFO",
              "Accepting prose response after prior tool execution (skipping extra TOOL_CALL retries)",
            );
            finalText = responseText;
            break;
          }

          // Trigger corrective retries if EITHER the user's message looked
          // actionable OR the model's reply itself narrated an action it
          // didn't emit a TOOL_CALL for ("Let me check the binary exists…").
          // The latter catches the common stall pattern where the model says
          // it will do something and then stops without doing it. Bounded by
          // the same MAX_GENERIC_NO_TOOL_CALL_RETRIES cap as before.
          const narratedAction =
            looksLikeNarratedActionWithoutToolCall(responseText);
          if (actionableToolIntent || narratedAction) {
            if (genericNoToolCallRetries < MAX_GENERIC_NO_TOOL_CALL_RETRIES) {
              genericNoToolCallRetries++;
              recordToolCallReliability(log, "correctiveRetries", {
                retry: genericNoToolCallRetries,
                maxRetries: MAX_GENERIC_NO_TOOL_CALL_RETRIES,
                model,
                narrated: narratedAction,
                trigger: actionableToolIntent
                  ? "actionable_user_message"
                  : "narrated_action_without_tool_call",
              });
              const triggerSummary = actionableToolIntent
                ? "actionable request"
                : "narrated action without a tool call";
              sendEvent({
                notice: {
                  kind: "tool_call_retry",
                  retry: genericNoToolCallRetries,
                  maxRetries: MAX_GENERIC_NO_TOOL_CALL_RETRIES,
                  message: `The model responded without an executable tool call (${triggerSummary}). Retrying with stricter instructions.`,
                },
              });
              log(
                "INFO",
                `No TOOL_CALL for ${triggerSummary}; corrective retry ${genericNoToolCallRetries}/${MAX_GENERIC_NO_TOOL_CALL_RETRIES}`,
                { narrated: narratedAction },
              );
              loopMessages.push({ role: "assistant", content: responseText });
              loopMessages.push({
                role: "user",
                content:
                  (narratedAction
                    ? "You said you would do something but did not emit a TOOL_CALL. Output exactly one TOOL_CALL now and nothing else — no narration. "
                    : genericNoToolCallCorrectionMessage + " ") +
                  '\n\nExamples:\nTOOL_CALL: builtin.run_terminal_cmd({"command":"ls","args":["-la"]})\nTOOL_CALL: builtin.read_file({"path":"README.md"})',
              });
              continue;
            }
            if (!toolReliabilityFallbackTried) {
              toolReliabilityFallbackTried = true;
              recordToolCallReliability(log, "fallbackAttempts", {
                fromModel: model,
                mode,
              });
              try {
                const fallback = await resolveAutoModel({
                  requestedModel: "auto",
                  mode,
                  estimatedTokens,
                  config,
                  ollamaUrl: config.ollamaUrl,
                  ollamaOpts: ollamaAuthOpts(config),
                  preferVision: hasImages,
                  preferToolCapable:
                    mode === "experiment" ||
                    config.agentTerminal?.enabled === true ||
                    toolCallHandler.hasExternalMcpTools(),
                  excludeModels: [model],
                });
                if (fallback.resolved && fallback.resolved !== model) {
                  const fromModel = model;
                  model = fallback.resolved;
                  toolReliabilityFallbackSucceeded = true;
                  // Cloud models reject `num_ctx`; drop it if the fallback
                  // moved us from a local model to a cloud one mid-loop.
                  if (isCloudModelName(model) && ollamaOptions.num_ctx) {
                    delete ollamaOptions.num_ctx;
                  }
                  // Demote the failing model for the rest of this session so
                  // future turns skip it without paying the corrective-retry
                  // cost again. Decays after 1 hour.
                  demoteModel(fromModel, "tool_call_failure");
                  recordToolCallReliability(log, "fallbackSuccesses", {
                    fromModel,
                    toModel: model,
                    mode,
                    demoted: true,
                  });
                  genericNoToolCallRetries = 0;
                  sendEvent({
                    notice: {
                      kind: "tool_call_model_fallback",
                      fromModel,
                      toModel: model,
                      demoted: true,
                      message: `Switching to ${model} for this turn because ${fromModel} did not emit executable tool calls. ${fromModel} is demoted for this session.`,
                    },
                  });
                  sendEvent({ resolvedModel: model });
                  loopMessages.push({
                    role: "assistant",
                    content: responseText,
                  });
                  loopMessages.push({
                    role: "user",
                    content: genericNoToolCallCorrectionMessage,
                  });
                  continue;
                }
              } catch (err) {
                log(
                  "WARN",
                  "Tool-call reliability fallback model resolution failed",
                  {
                    error: err.message,
                  },
                );
              }
            }
            recordToolCallReliability(log, "hardBlocks", {
              model,
              fallbackTried: toolReliabilityFallbackTried,
              fallbackSucceeded: toolReliabilityFallbackSucceeded,
              mode,
            });
            sendEvent({
              notice: {
                kind: "tool_call_blocked",
                message:
                  "The model did not emit executable tool calls after retries, so this turn cannot continue safely.",
              },
            });
            finalText = toolReliabilityFallbackSucceeded
              ? 'I’m blocked because the model kept returning prose instead of executable TOOL_CALL output even after switching models for this turn. Please retry and explicitly request: "Output only TOOL_CALL and no prose."'
              : 'I’m blocked because the model repeatedly returned prose instead of an executable TOOL_CALL, so no action could run. Please retry with a tool-reliable model, or phrase the request as: "Output only TOOL_CALL and no prose."';
            break;
          }

          debug("No TOOL_CALL patterns found, returning as final text");
          finalText = responseText;
          break;
        }

        // Execute tool calls and build results
        log(
          "INFO",
          `Round ${round + 1}: found ${toolCalls.length} tool call(s)`,
        );
        sendEvent({
          toolCallRound: round + 1,
          toolCalls: toolCalls.map((t) => `${t.serverId}.${t.toolName}`),
        });

        // Segment tool calls: order-preserving parallel/serial segments
        // When toolExec.parallel is false (default), treat all calls as serial
        const _toolExec = getConfig().toolExec || {};
        const parallelEnabled = _toolExec.parallel === true;
        const maxConcurrent = _toolExec.maxConcurrent ?? 4;
        const segments = parallelEnabled
          ? toolCallHandler.segmentToolCalls(toolCalls)
          : toolCalls.map((call, idx) => ({
              type: "serial",
              calls: [{ ...call, originalIndex: idx }],
            }));
        const resultsByOriginalIndex = new Array(toolCalls.length);

        // Helper: process tool result and extract parts
        async function executeSingleTool(call) {
          debug("Executing tool call", {
            server: call.serverId,
            tool: call.toolName,
          });
          if (isForbiddenFileWriteCall(call)) {
            hasBlockedFileWriteTool = true;
            log(
              "WARN",
              disallowFileWrites
                ? "Blocked file-writing tool due to explicit user constraint"
                : "Blocked file-writing tool — chat mode strict file writes (no explicit user request)",
              {
                tool: `${call.serverId}.${call.toolName}`,
                mode,
              },
            );
            return {
              success: false,
              error: blockedFileWriteToolErrorMessage,
            };
          }
          // Show a progress indicator for image-generating tools (they can take 10-30s)
          if (/generate.*image|image.*gen/i.test(call.toolName)) {
            sendEvent({
              terminalCmd: {
                command: call.toolName,
                args: [call.args?.prompt || ""],
              },
            });
          }
          return await toolCallHandler.executeTool(
            call.serverId,
            call.toolName,
            call.args,
          );
        }

        let toolResults = "";
        const roundAnalysisImages = []; // base64 images for vision model (from view_pdf_pages)

        // Execute segments in original call order — parallel segments run concurrently
        for (const segment of segments) {
          if (chatAbortController.signal.aborted || res.writableEnded) {
            log("INFO", "Chat aborted during tool execution");
            if (!res.writableEnded) {
              res.write("data: [DONE]\n\n");
              res.end();
            }
            return;
          }
          sendEvent({
            toolBatchStatus: {
              type: segment.type,
              count: segment.calls.length,
            },
          });
          if (segment.type === "parallel") {
            // Bounded concurrency: run at most maxConcurrent tools at once
            const calls = segment.calls;
            const results = new Array(calls.length);
            let next = 0;
            async function runWorker() {
              while (next < calls.length) {
                const i = next++;
                results[i] = await executeSingleTool(calls[i]).catch((err) => ({
                  success: false,
                  error: err.message,
                }));
              }
            }
            const workers = Array.from(
              { length: Math.min(maxConcurrent, calls.length) },
              runWorker,
            );
            await Promise.all(workers);
            calls.forEach((call, i) => {
              resultsByOriginalIndex[call.originalIndex] = results[i];
            });
          } else {
            const call = segment.calls[0];
            resultsByOriginalIndex[call.originalIndex] =
              await executeSingleTool(call);
          }
        }

        // Process results in original toolCalls order (critical for model context)
        for (let idx = 0; idx < toolCalls.length; idx++) {
          const call = toolCalls[idx];
          const result = resultsByOriginalIndex[idx];
          if (result.success) {
            const parts = result.result?.content || [];
            const textParts = parts
              .filter((c) => c.type === "text")
              .map((c) => c.text);
            const imageParts = parts.filter((c) => c.type === "image");
            const analysisImageParts = parts.filter(
              (c) => c.type === "image_for_analysis",
            );
            debug("MCP tool result", {
              tool: `${call.serverId}.${call.toolName}`,
              textParts: textParts.length,
              imageParts: imageParts.length,
              analysisImages: analysisImageParts.length,
              partTypes: parts.map((p) => p.type),
              resultKeys: Object.keys(result.result || {}),
            });
            let content = textParts.join("\n") || JSON.stringify(result.result);
            // Collect images for vision model (view_pdf_pages) — fed into next Ollama call
            for (const img of analysisImageParts) {
              if (img.data) roundAnalysisImages.push(img.data);
            }
            // Stream display-only images to client; do NOT embed base64 in AI context (wastes tokens)
            for (const img of imageParts) {
              const mimeType = img.mimeType || "image/png";
              const data = img.data; // base64
              if (data) {
                // Send image to client for immediate rendering
                sendEvent({
                  toolImage: {
                    mimeType,
                    data,
                    tool: `${call.serverId}.${call.toolName}`,
                  },
                });
                content += `\n[IMAGE_DELIVERED: The image has been generated and is NOW DISPLAYED in the chat above this message. It is already fully visible to the user — you do NOT need to embed markdown or placeholders. Write a brief, confident acknowledgment that you generated the image (describe its content based on the prompt you used) and ask if they would like any changes. Do NOT say you cannot see the image or that you are unable to view it.]`;
              }
            }
            toolResults += `\nTool ${call.serverId}.${call.toolName} returned:\n${content}\n`;
          } else {
            toolResults += `\nTool ${call.serverId}.${call.toolName} failed: ${formatToolFailureMessage(result)}\n`;
          }
        }
        const roundHadSuccessfulToolCall = resultsByOriginalIndex.some(
          (result) => result?.success,
        );
        hasExecutedToolCall = hasExecutedToolCall || roundHadSuccessfulToolCall;
        lastToolCallSignature = currentToolCallSignature;
        accumulatedToolResults = appendCappedToolResults(
          accumulatedToolResults,
          `Round ${round + 1} tool results:\n${toolResults}`,
          TOOL_RESULTS_FINALIZER_MAX_CHARS,
        );

        // Stream tool results to the client so the user sees what the tools
        // actually returned, not just the AI's synthesized summary.
        // Truncate very large results (e.g. big file reads) to keep the chat readable.
        if (!chatAbortController.signal.aborted && !res.writableEnded) {
          const MAX_DISPLAY_CHARS = 2000;
          const displayResults = toolResults.trim();
          const truncated =
            displayResults.length > MAX_DISPLAY_CHARS
              ? displayResults.slice(0, MAX_DISPLAY_CHARS) +
                "\n…(truncated for display)"
              : displayResults;
          sendEvent({ toolResultText: truncated });
        }

        // Feed tool results back as assistant + tool-result messages.
        // Strip everything after the first TOOL_CALL — models sometimes hallucinate
        // fake results after the call pattern, which confuses subsequent rounds.
        const firstToolIdx = responseText.indexOf("TOOL_CALL:");
        const cleanedResponse =
          firstToolIdx >= 0
            ? responseText.slice(0, firstToolIdx).trim()
            : responseText;
        if (cleanedResponse) {
          loopMessages.push({ role: "assistant", content: cleanedResponse });
        }
        const _executedBrowserTool = toolCalls.some(
          (c) =>
            c.serverId === "builtin" &&
            [
              "browse_url",
              "browser_snapshot",
              "browser_click",
              "browser_type",
              "browser_scroll",
            ].includes(c.toolName),
        );
        lastRoundHadBrowserTool = _executedBrowserTool;
        const shouldFinalizeBrowserContent =
          _executedBrowserTool &&
          browserContentAnswerRequested &&
          hasUsefulBrowserContent(accumulatedToolResults);
        // CTXFIX Phase 3 — externalize BEFORE wrapping so the wrapper text
        // ("Tool results:\n…", "Present these results…", browser variant)
        // is preserved around either the original stdout or a placeholder.
        // The helper reads `cumulativeRef.value` for the threshold; the
        // caller (us) is the sole writer.
        const externalizedToolResults = maybeExternalizeToolOutput(
          toolResults,
          {
            config,
            conversationId,
            reqSuffix,
            roundIdx: round,
            cumulativeRef,
          },
        );
        cumulativeRef.value += externalizedToolResults.length;
        const toolResultMsg = {
          role: "user",
          content: _executedBrowserTool
            ? `Tool results:\n${externalizedToolResults}\n\n⚡ BROWSER TASK IN PROGRESS — Review the result above and determine the next required browser action.\n\nIf the user's request is NOT yet fully complete, output ONLY a TOOL_CALL for the next action — no prose, no explanation. Examples:\n\nTOOL_CALL: builtin.browser_click({"selector": "button[type=submit]"})\nTOOL_CALL: builtin.browser_click({"text": "Continue"})\nTOOL_CALL: builtin.browser_type({"selector": "#username", "text": "TAdmin"})\nTOOL_CALL: builtin.browser_snapshot({})\n\nTip: to submit a login form, prefer selector "button[type=submit]" over text matching.\n\nOnly write a plain text response to the user when ALL steps in their original request are 100% done.`
            : `Tool results:\n${externalizedToolResults}\n\n⚡ PRESENT RESULTS NOW — The tool has completed successfully. Present the tool results to the user immediately in a clear, direct response. Do NOT:
- Write files or take additional actions
- Narrate what you "will" do next
- Add extra steps beyond presenting these results
- Output TOOL_CALL again unless the user asks a follow-up question

Simply show the user what the tool returned. If the user later asks for revisions, you MUST call the tool again with updated parameters.`,
        };
        // Attach PDF page images so the vision model can analyze them
        if (roundAnalysisImages.length > 0) {
          toolResultMsg.images = roundAnalysisImages;
          log(
            "INFO",
            `Feeding ${roundAnalysisImages.length} PDF page image(s) to vision model`,
          );
        }
        loopMessages.push(toolResultMsg);
        // Persist tool round context for client history (text only — no images)
        if (cleanedResponse) {
          toolContextForHistory.push({
            role: "assistant",
            content: cleanedResponse,
          });
        }
        toolContextForHistory.push({
          role: "user",
          content: `[Tool: ${toolCalls.map((c) => `${c.serverId}.${c.toolName}`).join(", ")}]\n${externalizedToolResults}`,
        });
        if (shouldFinalizeBrowserContent) {
          finalText = await generateFinalTextFromToolResults(
            "Browser content gathered for read/summarize request; generating final answer without more browser actions",
          );
          if (finalText && finalText.trim()) {
            break;
          }
        }
      }

      if (
        !finalText &&
        accumulatedToolResults.trim() &&
        !chatAbortController.signal.aborted &&
        !res.writableEnded
      ) {
        // Surface the round-cap hit to the client so the chat UI shows a visible
        // reason for the stop instead of a short, unexplained reply.
        sendEvent({
          notice: {
            kind: "round_limit",
            rounds: MAX_ROUNDS,
            message: `Hit max tool-call rounds (${MAX_ROUNDS}) for this turn. Generating a final answer from the tool results gathered so far. Raise the limit in Settings → Agent → Max Rounds if this happens often.`,
          },
        });
        finalText = await generateFinalTextFromToolResults(
          `Tool-call loop ended without final text after ${MAX_ROUNDS} rounds; generating final answer from accumulated tool results`,
          { roundLimitHit: true, roundsUsed: MAX_ROUNDS },
        );
      }

      // Send tool context to client so it can persist the tool-call chain in conversation history
      if (
        toolContextForHistory.length > 0 &&
        !chatAbortController.signal.aborted &&
        !res.writableEnded
      ) {
        sendEvent({ toolContextMessages: toolContextForHistory });
      }

      // Stream the final text as SSE tokens (word by word for UX)
      if (finalText && finalText.trim()) {
        // Strip <think>...</think> reasoning blocks — local models (e.g. qwen3) emit these
        // as internal monologue; they are not useful to the user and often contain false
        // statements like "I can't see the image".
        const displayText = finalText
          .replace(/<think>[\s\S]*?<\/think>/gi, "")
          .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
          .trim();
        if (displayText) {
          const words = displayText.split(/(\s+)/);
          for (const word of words) {
            if (chatAbortController.signal.aborted || res.writableEnded) break;
            sendEvent({ token: word });
          }
        } else if (!chatAbortController.signal.aborted && !res.writableEnded) {
          log("WARN", "Final assistant text was empty after cleanup", {
            model,
          });
          sendEvent({ error: buildEmptyAssistantReplyMessage(model) });
        }
      } else if (
        !finalText &&
        !accumulatedToolResults &&
        !chatAbortController.signal.aborted &&
        !res.writableEnded
      ) {
        // Fallback: model didn't support tool calls — re-send via streaming without tool prompt
        log("INFO", "Falling back to streaming mode (no tool-call support)");
        try {
          // Strip tool instructions from system prompt for the streaming fallback
          const fallbackMessages = fullMessages.map((m) =>
            m.role === "system"
              ? {
                  role: "system",
                  content: stripAgentToolsPrompt(m.content),
                }
              : m,
          );
          // Vision regression (v1.6.44): chatStream is ONLY (url, model, messages, images, options).
          // Never insert a token callback as 4th arg — Ollama will not receive images.
          const streamRes = await chatStream(
            config.ollamaUrl,
            model,
            fallbackMessages,
            images || [],
            {
              ...ollamaOptions,
              abortSignal: chatAbortController.signal,
            },
          );
          if (!streamRes.ok) {
            const { formatted } = await summarizeOllamaFail(streamRes);
            sendEvent({ error: formatted });
          } else {
            const fbReader = streamRes.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let tokenCount = 0;
            try {
              while (true) {
                const { done, value } = await fbReader.read();
                if (done) {
                  if (buffer.trim()) {
                    try {
                      const parsed = JSON.parse(buffer);
                      if (parsed.message?.content) {
                        sendEvent({ token: parsed.message.content });
                        tokenCount++;
                      }
                      if (parsed.done) {
                        sendEvent({
                          done: true,
                          total_duration: parsed.total_duration,
                          eval_count: parsed.eval_count,
                        });
                      }
                    } catch {
                      /* ignore trailing parse errors */
                    }
                  }
                  break;
                }
                if (chatAbortController.signal.aborted || res.writableEnded)
                  break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";
                for (const line of lines) {
                  if (!line.trim()) continue;
                  try {
                    const parsed = JSON.parse(line);
                    if (parsed.message?.content) {
                      sendEvent({ token: parsed.message.content });
                      tokenCount++;
                    }
                    if (parsed.done) {
                      sendEvent({
                        done: true,
                        total_duration: parsed.total_duration,
                        eval_count: parsed.eval_count,
                      });
                    }
                  } catch (e) {
                    debug("Fallback stream parse chunk", {
                      line: line.substring(0, 100),
                      error: e.message,
                    });
                  }
                }
              }
            } catch (err) {
              if (
                err.name !== "AbortError" &&
                !chatAbortController.signal.aborted
              ) {
                log("ERROR", "Streaming fallback read failed", {
                  error: err.message,
                });
              }
            }
            log("INFO", `Streaming fallback complete: ${tokenCount} tokens`);
            if (
              tokenCount === 0 &&
              !chatAbortController.signal.aborted &&
              !res.writableEnded
            ) {
              log("WARN", "Streaming fallback returned zero tokens", { model });
              sendEvent({ error: buildEmptyAssistantReplyMessage(model) });
            }
          }
        } catch (err) {
          if (!chatAbortController.signal.aborted) {
            log("ERROR", "Streaming fallback failed", { error: err.message });
            sendEvent({ error: STREAM_INTERNAL_ERROR });
          }
        }
      } else if (!chatAbortController.signal.aborted && !res.writableEnded) {
        // Model never produced a user-facing reply (only tools, or hit round limit, or empty content)
        sendEvent({
          error:
            "No assistant reply was produced after tool rounds. The model may have only emitted tool calls, hit the tool round limit, or returned empty text. Try a simpler question, reduce MCP tools, or check Ollama / MCP connectivity.",
        });
      }
      // Always send done so the client clears tool/terminal UI (tool-call path does not stream Ollama done frames)
      if (!chatAbortController.signal.aborted && !res.writableEnded) {
        sendEvent({ done: true });
      }
      if (!res.writableEnded) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
      toolCallHandler.sseContext = null;
      log("INFO", `Chat complete (tool-call mode): ${finalText.length} chars`);
      return;
    }
    toolCallHandler.sseContext = null;

    // ── Standard streaming path (no agent tools) ──
    let reader = null;
    let ollamaRes;
    const triedOpaqueModels = new Set();
    const MAX_OPAQUE_RETRIES = 2;
    let opaqueRetryAttempts = 0;
    while (true) {
      triedOpaqueModels.add(model);
      // Same chatStream 5-arg contract as agent fallback above (vision).
      ollamaRes = await chatStream(
        config.ollamaUrl,
        model,
        fullMessages,
        images || [],
        {
          ...ollamaOptions,
          abortSignal: chatAbortController.signal,
        },
      );

      debug("Ollama chat response", {
        status: ollamaRes.status,
        ok: ollamaRes.ok,
      });

      if (ollamaRes.ok) break;

      const { status, detail, formatted } =
        await summarizeOllamaFail(ollamaRes);
      log("ERROR", `Ollama chat error: ${status}`, {
        body: formatted,
      });
      const totalLen = fullMessages.reduce(
        (sum, m) => sum + (m.content?.length || 0),
        0,
      );
      const cloudOpaque500 =
        status === 500 &&
        /ref:\s*[0-9a-f-]{8,}/i.test(detail || "") &&
        wasAutoResolved &&
        isCloudModelName(model);

      if (cloudOpaque500) {
        demoteModel(model, "cloud_opaque_500");
        log(
          "WARN",
          `Cloud model ${model} returned opaque 500; demoted for this session.`,
          { detail: String(detail || "").slice(0, 300) },
        );
      }

      // Auto-mode self-heal: instead of bouncing the error back to the user,
      // resolve a different model and retry the request transparently.
      if (cloudOpaque500 && opaqueRetryAttempts < MAX_OPAQUE_RETRIES) {
        let next = null;
        try {
          next = await resolveAutoModel({
            requestedModel: "auto",
            mode,
            estimatedTokens: estimatedTokensPre,
            config,
            ollamaUrl: config.ollamaUrl,
            ollamaOpts: ollamaAuthOpts(config),
            preferVision: hasImages,
            excludeModels: Array.from(triedOpaqueModels),
          });
        } catch (err) {
          log("WARN", "Auto-retry resolution failed after opaque 500", {
            error: err.message,
          });
        }

        if (next && next.resolved && !triedOpaqueModels.has(next.resolved)) {
          const fromModel = model;
          model = next.resolved;
          opaqueRetryAttempts++;
          // Cloud models reject `num_ctx`; drop it if we just moved cloud→cloud
          // or if the new model is cloud and num_ctx happens to be set.
          if (isCloudModelName(model) && ollamaOptions.num_ctx) {
            delete ollamaOptions.num_ctx;
          }
          log(
            "INFO",
            `Auto-retry after cloud opaque 500: ${fromModel} → ${model} (attempt ${opaqueRetryAttempts}/${MAX_OPAQUE_RETRIES})`,
          );
          sendEvent({
            notice: {
              kind: "cloud_model_demoted",
              fromModel,
              toModel: model,
              reason: "cloud_opaque_500",
              autoRetry: true,
              attempt: opaqueRetryAttempts,
              maxAttempts: MAX_OPAQUE_RETRIES,
              message: `${fromModel} hit a cloud error — auto-retrying with ${model}.`,
            },
          });
          sendEvent({ resolvedModel: model });
          continue;
        }
      }

      if (cloudOpaque500) {
        sendEvent({
          notice: {
            kind: "cloud_model_demoted",
            model,
            reason: "cloud_opaque_500",
            message: `${model} returned an opaque cloud error and was demoted for this session. Retry the message — auto mode will pick a different model.`,
          },
        });
      }
      const userError = formatUserOllamaChatError({
        status,
        detail,
        totalChars: totalLen,
        log,
      });
      sendEvent({ error: userError });
      res.write("data: [DONE]\n\n");
      return res.end();
    }

    reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let tokenCount = 0;

    debug("Starting stream read loop");

    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            debug("Stream ended", { tokensStreamed: tokenCount });
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer);
                if (parsed.message?.content) {
                  sendEvent({ token: parsed.message.content });
                  tokenCount++;
                }
                if (parsed.done) {
                  sendEvent({
                    done: true,
                    total_duration: parsed.total_duration,
                    eval_count: parsed.eval_count,
                  });
                }
              } catch (e) {
                debug("Failed to parse final buffer", {
                  buffer,
                  error: e.message,
                });
              }
            }
            if (!res.writableEnded) {
              res.write("data: [DONE]\n\n");
              res.end();
            }
            log("INFO", `Chat complete: ${tokenCount} tokens streamed`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) {
                sendEvent({ token: parsed.message.content });
                tokenCount++;
              }
              if (parsed.done) {
                debug("Ollama signaled done", {
                  total_duration: parsed.total_duration,
                  eval_count: parsed.eval_count,
                });
                sendEvent({
                  done: true,
                  total_duration: parsed.total_duration,
                  eval_count: parsed.eval_count,
                });
                res.write("data: [DONE]\n\n");
                res.end();
                log("INFO", `Chat complete: ${tokenCount} tokens streamed`);
                return;
              }
            } catch (e) {
              debug("Failed to parse stream chunk", {
                line: line.substring(0, 100),
                error: e.message,
              });
            }
          }
        }
      } catch (err) {
        if (err.name === "AbortError" || chatAbortController.signal.aborted) {
          debug("Stream read aborted (client stopped)");
          if (!res.writableEnded) {
            res.write("data: [DONE]\n\n");
            res.end();
          }
          return;
        }
        log("ERROR", "Stream read error", { error: err.message });
        if (!res.writableEnded) {
          // Phase 6: Vision-specific error messages
          const msg = err.message.toLowerCase();
          if (msg.includes("timeout") || msg.includes("timed out")) {
            sendEvent({
              error:
                images?.length > 0
                  ? "Request timed out. Vision models can take longer - try fewer images."
                  : "Request timed out. Try a shorter message or fewer images.",
            });
          } else if (
            msg.includes("context") &&
            (msg.includes("window") ||
              msg.includes("length") ||
              msg.includes("exceeded"))
          ) {
            sendEvent({
              error:
                "Context window exceeded. Try reducing message history or images.",
            });
          } else {
            const parsed = parseOllamaErrMsg(err.message);
            const totalLen = fullMessages.reduce(
              (sum, m) => sum + (m.content?.length || 0),
              0,
            );
            const detail =
              parsed.detail ||
              (parsed.status === 0 ? String(err.message || "").trim() : "");
            sendEvent({
              error: formatUserOllamaChatError({
                status: parsed.status || 503,
                detail,
                totalChars: totalLen,
                log,
              }),
            });
          }
          res.write("data: [DONE]\n\n");
          res.end();
        }
      }
    }

    readStream();

    req.on("close", () => {
      debug("Client disconnected during stream");
      chatAbortController.abort();
      reader?.cancel?.().catch(() => {});
    });
  } catch (err) {
    if (err.name === "AbortError" || chatAbortController.signal.aborted) {
      log("INFO", "Chat connection aborted");
      if (!res.writableEnded) {
        res.write("data: [DONE]\n\n");
        res.end();
      }
      return;
    }
    log("ERROR", `Chat connection failed`, {
      error: err.message,
      cause: err.cause?.message,
    });
    // Phase 6: Vision-specific error messages
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("timed out")) {
      sendEvent({
        error:
          images?.length > 0
            ? "Request timed out. Vision models can take longer - try fewer images."
            : "Request timed out. Try a shorter message or fewer images.",
      });
    } else if (
      msg.includes("context") &&
      (msg.includes("window") ||
        msg.includes("length") ||
        msg.includes("exceeded"))
    ) {
      sendEvent({
        error:
          "Context window exceeded. Try reducing message history or images.",
      });
    } else if (msg.includes("econnrefused") || msg.includes("enotfound")) {
      sendEvent({
        error: "Cannot connect to Ollama. Please check that Ollama is running.",
      });
    } else {
      const parsed = parseOllamaErrMsg(err.message);
      const totalLen = fullMessages.reduce(
        (sum, m) => sum + (m.content?.length || 0),
        0,
      );
      const detail =
        parsed.detail ||
        (parsed.status === 0 ? String(err.message || "").trim() : "");
      sendEvent({
        error: formatUserOllamaChatError({
          status: parsed.status || 503,
          detail,
          totalChars: totalLen,
          log,
        }),
      });
    }
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

module.exports = {
  handleChatPost,
  pendingConfirmations,
  buildEmptyAssistantReplyMessage,
  formatToolFailureMessage,
  // Exported for tests:
  userExplicitlyDisallowsFileWrites,
  userExplicitlyRequestsFileWrites,
  computeToolCallSignature,
  stripAttachedFileBlock,
  capAttachedFileBlock,
  tryPromoteNarratedShellToToolCall,
  shellLineFailsAutoPromotionSafety,
  userLikelyRequestedActionableToolWork,
  looksLikeFileWritePolicyMetaResponse,
};
