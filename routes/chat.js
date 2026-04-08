const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { getConfig } = require("../lib/config");
const { SYSTEM_PROMPTS } = require("../lib/prompts");
const {
  listModels,
  chatStream,
  chatComplete,
  effectiveOllamaApiKey,
} = require("../lib/ollama-client");
const { resolveAutoModel, mergeAutoModelMap } = require("../lib/auto-model");
const { buildFileTree } = require("../lib/file-browser");
const { buildMemoryContext } = require("../lib/memory");
const { STREAM_INTERNAL_ERROR } = require("../lib/client-errors");

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

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log, debug, logDir, toolCallHandler } = appContext;

  /** Pending confirm-before-run confirmations: id → { resolve, timeout } */
  const pendingConfirmations = new Map();

  // ── POST /api/chat/confirm — resolve a pending confirm-before-run prompt ──
  router.post(
    "/chat/confirm",
    express.json({ limit: "1kb" }),
    (req, res) => {
      const { id, approved } = req.body || {};
      if (!id) return res.status(400).json({ error: "Missing id" });
      const pending = pendingConfirmations.get(id);
      if (!pending) return res.status(404).json({ error: "Unknown confirmation id" });
      pendingConfirmations.delete(id);
      clearTimeout(pending.timeout);
      pending.resolve({ approved: !!approved });
      res.json({ ok: true });
    },
  );

  function ollamaAuthOpts(cfg) {
    const k = effectiveOllamaApiKey(cfg);
    return k ? { apiKey: k } : {};
  }

  // ── POST /api/chat (SSE streaming + tool-call loop) ──
  // Rate limiter applied as app.use('/api/chat', ...) in server.js
  router.post("/chat", async (req, res) => {
    const {
      model: reqModel,
      messages,
      mode,
      images,
      conversationId,
      agentMaxRounds,
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
      log("ERROR", `Too many images: ${images.length}`, { limit: 10 });
      return res.status(400).json({ error: "Maximum 10 images per message" });
    }

    const systemPrompt = SYSTEM_PROMPTS[mode];
    if (!systemPrompt) {
      log("ERROR", `Unknown mode: ${mode}`);
      return res.status(400).json({ error: `Unknown mode: ${mode}` });
    }

    log(
      "INFO",
      `Chat request: model=${model} mode=${mode} messages=${messages.length}`,
      {
        imageCount: images?.length || 0,
      },
    );

    const config = getConfig();

    let memoryPrompt = "";
    let memoryMeta = null;

    const totalCharsEstimate = messages.reduce(
      (s, m) => s + (typeof m.content === "string" ? m.content.length : 0),
      0,
    );
    const estimatedTokensPre = Math.ceil(totalCharsEstimate / 3.5);
    const hasImages = images && images.length > 0;
    // Check if user uploaded images earlier in this conversation (not MCP-generated ones)
    const historyHasUserImages =
      !hasImages &&
      messages.some(
        (m) =>
          m.role === "user" && Array.isArray(m.images) && m.images.length > 0,
      );

    const embModel = config.memory?.embeddingModel || "nomic-embed-text";
    const memoryConvId =
      typeof conversationId === "string" && conversationId.trim()
        ? conversationId.trim()
        : null;
    const memoryPromise = config.memory?.enabled
      ? buildMemoryContext(
          config.ollamaUrl,
          embModel,
          messages,
          config,
          memoryConvId,
        ).catch((err) => {
          log("WARN", "Memory retrieval failed, proceeding without", {
            error: err.message,
          });
          return { prompt: "", memories: null };
        })
      : Promise.resolve({ prompt: "", memories: null });

    if (model === "auto") {
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
            preferToolCapable: config.agentTerminal?.enabled === true,
          }),
          memoryPromise,
        ]);
        model = r.resolved;
        memoryPrompt = memCtx.prompt || "";
        memoryMeta = memCtx.memories;
        log("INFO", `Auto-model resolved: mode=${mode} → ${model}`);
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

    // Append brand assets context if configured
    const brandAssets = config.brandAssets || [];
    const brandPrompt =
      brandAssets.length > 0
        ? `\n\n---\nBRAND ASSETS: The user has configured these brand/logo/image files. Use them when creating, building, generating reports, or producing diagrams that need branding:\n${brandAssets.map((a) => `- ${a.label || "Asset"}: ${a.path}${a.description ? " — " + a.description : ""}`).join("\n")}`
        : "";

    // Inject project folder context (cached — large repos were slow on every message)
    const projectPrompt = getCachedProjectPrompt(config.projectFolder);

    // Set client key for intra-request terminal rate limiting
    toolCallHandler.clientKey =
      req.ip || req.connection?.remoteAddress || "unknown";

    // Append agent tool descriptions (MCP clients + builtin tools)
    const { prompt: toolsPrompt, hasTerminalTool } =
      toolCallHandler.getToolsPromptAndFlags();
    const hasAgentTools = toolsPrompt.length > 0;

    // Option A lead-in: prepend factual capability statement BEFORE the chat persona
    // so the model sees "you have a terminal" before "you are a patient teacher".
    // Only injected when run_terminal_cmd is advertised for this session.
    const leadIn = hasTerminalTool
      ? "CAPABILITY: This agent session has access to builtin tools that execute directly on the user's machine, including a terminal (run_terminal_cmd) scoped to their project folder. Use TOOL_CALL to run commands — do not ask the user to run them.\n\n"
      : "";

    // Inject vision-specific prompt when images are present
    const visionPrompt =
      images && images.length > 0
        ? `\n\n---\nIMAGES: The user has attached ${images.length} image(s). Analyze them carefully and reference them in your response when relevant.`
        : "";

    // Do not inject other conversations' summaries here — each thread keeps its own context via `messages` + scoped memory.

    const enrichedSystemPrompt =
      leadIn +
      systemPrompt +
      brandPrompt +
      projectPrompt +
      memoryPrompt +
      toolsPrompt +
      visionPrompt;

    if (hasAgentTools) {
      debug("Agent tools injected into system prompt", {
        toolsLength: toolsPrompt.length,
      });
    }

    // Strip base64 image data from message history — prevents 400 errors on cloud models
    // Images were already rendered client-side; AI doesn't need megabytes of base64 in follow-ups
    const BASE64_IMG_RE =
      /!\[([^\]]*)\]\(data:image\/[^;]+;base64,[A-Za-z0-9+/=]{100,}\)/g;
    const currentMsgHasImages = images && images.length > 0;
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
    const totalChars = fullMessages.reduce(
      (sum, m) => sum + (m.content?.length || 0),
      0,
    );
    const estimatedTokens = Math.ceil(totalChars / 3.5); // rough chars-to-tokens ratio
    let effectiveNumCtx = config.numCtx || 0;
    let effectiveTimeoutMs = (config.chatTimeoutSec || 120) * 1000;

    if (config.autoAdjustContext && estimatedTokens > 4096) {
      // Auto-boost num_ctx to fit content with headroom for response (~2K tokens)
      const needed = estimatedTokens + 2048;
      if (needed > effectiveNumCtx) {
        effectiveNumCtx = Math.min(needed, 524288); // cap at 512K
        log(
          "INFO",
          `Auto-adjusted num_ctx to ${effectiveNumCtx} (content ~${estimatedTokens} tokens)`,
        );
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
        const MAX_ROUNDS = Math.min(
          Math.max(parseInt(agentMaxRounds) || 10, 1),
          25,
        );
        let finalText = "";
        const toolContextForHistory = []; // text-only tool rounds — emitted to client for history persistence

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

          let responseText;
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
            } else if (msg.includes("500")) {
              const totalLen = loopMessages.reduce(
                (sum, m) => sum + (m.content?.length || 0),
                0,
              );
              sendEvent({
                error:
                  totalLen > 30000
                    ? `Ollama error: the message content (~${(totalLen / 1024).toFixed(0)} KB) likely exceeds the model's context window. Try a shorter document or a model with a larger context window.`
                    : STREAM_INTERNAL_ERROR,
              });
            } else {
              sendEvent({ error: STREAM_INTERNAL_ERROR });
            }
            res.write("data: [DONE]\n\n");
            return res.end();
          }

          // Check for tool calls
          debug("Ollama response (first 500 chars)", {
            text: responseText.substring(0, 500),
          });
          const toolCalls = toolCallHandler.parseToolCalls(responseText);

          if (toolCalls.length === 0) {
            // No tool calls found. If the response is suspiciously short on the first round,
            // the model likely doesn't support TOOL_CALL: format — fall back to streaming mode
            // so the user gets a full response instead of a stub like "Let me examine..."
            if (round === 0 && responseText.length < 200) {
              log(
                "WARN",
                `Model returned short non-tool response (${responseText.length} chars) on round 1 — falling back to streaming mode`,
              );
              // Break out and let the streaming path below handle the re-request
              finalText = "";
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

          let toolResults = "";
          const roundAnalysisImages = []; // base64 images for vision model (from view_pdf_pages)
          for (const call of toolCalls) {
            if (chatAbortController.signal.aborted || res.writableEnded) {
              log("INFO", "Chat aborted before tool execution");
              if (!res.writableEnded) {
                res.write("data: [DONE]\n\n");
                res.end();
              }
              return;
            }
            debug("Executing tool call", {
              server: call.serverId,
              tool: call.toolName,
            });
            const result = await toolCallHandler.executeTool(
              call.serverId,
              call.toolName,
              call.args,
            );
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
                  content += `\n[IMAGE_DELIVERED: image was rendered in the chat for the user. Describe what was generated. If the user asks for changes, call generate_image again with a revised prompt.]`;
                }
              }
              toolResults += `\nTool ${call.serverId}.${call.toolName} returned:\n${content}\n`;
            } else {
              toolResults += `\nTool ${call.serverId}.${call.toolName} failed: ${result.error}\n`;
            }
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
          const toolResultMsg = {
            role: "user",
            content: `Tool results:\n${toolResults}\n\nPresent these results to the user in a helpful response. Do NOT call the same tool again unless the user explicitly asks for a different operation. Do NOT write fake image markdown or placeholders — images are already displayed. If the user later asks for revisions, you MUST call the tool again with an updated prompt.`,
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
            content: `[Tool: ${toolCalls.map((c) => `${c.serverId}.${c.toolName}`).join(", ")}]\n${toolResults}`,
          });
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
          const words = finalText.split(/(\s+)/);
          for (const word of words) {
            if (chatAbortController.signal.aborted || res.writableEnded) break;
            sendEvent({ token: word });
          }
        } else if (
          !finalText &&
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
                    content: m.content.replace(
                      /\n\n---\nAGENT TOOLS[\s\S]*$/,
                      "",
                    ),
                  }
                : m,
            );
            let tokenCount = 0;
            await chatStream(
              config.ollamaUrl,
              model,
              fallbackMessages,
              (token) => {
                if (chatAbortController.signal.aborted || res.writableEnded)
                  return;
                tokenCount++;
                sendEvent({ token });
              },
              images || [],
              {
                ...ollamaOptions,
                abortSignal: chatAbortController.signal,
              },
            );
            log("INFO", `Streaming fallback complete: ${tokenCount} tokens`);
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
      const ollamaRes = await chatStream(
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

      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        log("ERROR", `Ollama chat error: ${ollamaRes.status}`, {
          body: errText,
        });
        // Provide helpful context for common Ollama errors
        let userError;
        if (ollamaRes.status === 500) {
          const totalLen = fullMessages.reduce(
            (sum, m) => sum + (m.content?.length || 0),
            0,
          );
          userError =
            totalLen > 30000
              ? `Ollama error: the message content (~${(totalLen / 1024).toFixed(0)} KB) likely exceeds the model's context window. Try a shorter document, reduce conversation history, or use a model with a larger context window.`
              : STREAM_INTERNAL_ERROR;
        } else {
          userError = `Ollama returned HTTP ${ollamaRes.status}. Check the model name and try again.`;
        }
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
              sendEvent({ error: STREAM_INTERNAL_ERROR });
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
          error:
            "Cannot connect to Ollama. Please check that Ollama is running.",
        });
      } else {
        sendEvent({ error: STREAM_INTERNAL_ERROR });
      }
      res.write("data: [DONE]\n\n");
      res.end();
    }
  });

  return router;
};
