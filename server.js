const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { Readable } = require('stream');

// ── Lib imports ──────────────────────────────────────
const { createLogger } = require('./lib/logger');
const { initConfig, getConfig, updateConfig } = require('./lib/config');
const { initHistory, listConversations, getConversation, saveConversation, deleteConversation } = require('./lib/history');
const { initMemory, addMemory, getMemories, getMemory, updateMemory, deleteMemory, searchMemories, getStats: getMemoryStats, extractAndStore, buildMemoryContext } = require('./lib/memory');
const { SYSTEM_PROMPTS } = require('./lib/prompts');
const { listModels, checkConnection, chatStream, chatComplete, embed } = require('./lib/ollama-client');
const { buildFileTree, readProjectFile, saveProjectFile, isWithinBasePath, isTextFile, TEXT_EXTENSIONS, IGNORE_DIRS, readFolderFiles } = require('./lib/file-browser');
const { scaffoldProject } = require('./lib/icm-scaffolder');
const { scaffoldBuildProject } = require('./lib/build-scaffolder');
const GsdBridge = require('./lib/gsd-bridge');
const { validateProjects, addProject, getProject, removeProject } = require('./lib/build-registry');
const { cloneRepo, deleteClonedRepo, listClonedRepos, listUserRepos, validateToken, createRepo, initAndPush } = require('./lib/github');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { registerAllTools } = require('./mcp/tools');
const McpClientManager = require('./lib/mcp-client-manager');
const ToolCallHandler = require('./lib/tool-call-handler');
const { createMcpApiRoutes } = require('./lib/mcp-api-routes');
const { reviewCode } = require('./lib/review');
const { pentestCode, pentestFolder } = require('./lib/pentest');
const { scanProjectForValidation, generateValidateCommand } = require('./lib/validate');
const { scoreContent } = require('./lib/builder-score');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0'; // use 0.0.0.0 to allow remote access
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

// HTTPS: use cert/server.crt + cert/server.key if present (self-signed or otherwise)
// Set FORCE_HTTP=1 to disable HTTPS (e.g. for rate-limit test or local validation)
const certPath = path.join(__dirname, 'cert', 'server.crt');
const keyPath = path.join(__dirname, 'cert', 'server.key');
const useHttps = process.env.FORCE_HTTP !== '1' && fs.existsSync(certPath) && fs.existsSync(keyPath);

function maskSensitiveValue(value) {
  if (!value) return '';
  if (typeof value !== 'string') return '[REDACTED]';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

function sanitizeConfigForClient(config) {
  const safe = { ...config };
  safe.githubTokenConfigured = Boolean(safe.githubToken);
  if ('githubToken' in safe) {
    delete safe.githubToken;
  }

  delete safe.license;

  if (safe.mcpServers && typeof safe.mcpServers === 'object') {
    const clonedServers = {};
    for (const [name, server] of Object.entries(safe.mcpServers)) {
      const cloned = { ...server };
      if (cloned.env && typeof cloned.env === 'object') {
        const maskedEnv = {};
        for (const [k, v] of Object.entries(cloned.env)) {
          const lower = String(k).toLowerCase();
          const looksSensitive = lower.includes('token') || lower.includes('secret') || lower.includes('password') || lower.includes('key');
          maskedEnv[k] = looksSensitive ? maskSensitiveValue(v) : v;
        }
        cloned.env = maskedEnv;
      }
      clonedServers[name] = cloned;
    }
    safe.mcpServers = clonedServers;
  }

  return safe;
}

function getClientAddress(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function createRateLimiter({ name, max, windowMs, methods }) {
  const buckets = new Map();
  const allowedMethods = new Set((methods || ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).map(m => String(m).toUpperCase()));
  const safeMax = Math.max(1, Number(max) || 1);
  const safeWindowMs = Math.max(1000, Number(windowMs) || 60000);

  return function rateLimiter(req, res, next) {
    if (!allowedMethods.has(req.method.toUpperCase())) {
      return next();
    }

    const now = Date.now();
    const key = `${name}:${getClientAddress(req)}`;
    const record = buckets.get(key);
    if (!record || now >= record.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + safeWindowMs });
      return next();
    }

    if (record.count >= safeMax) {
      const retryAfter = Math.max(1, Math.ceil((record.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({ error: 'Too many requests', code: 'RATE_LIMITED', retryAfter });
    }

    record.count += 1;
    return next();
  };
}

// ── Initialize modules ───────────────────────────────
const dataRoot = process.env.CC_DATA_DIR || __dirname;
initConfig(dataRoot);
initHistory(dataRoot);
initMemory(dataRoot);
const { log, debug, logDir } = createLogger(dataRoot, { debugEnabled: DEBUG });

// ── Initialize MCP Client Manager ────────────────────
const mcpClientManager = new McpClientManager({ log, debug });
const toolCallHandler = new ToolCallHandler(mcpClientManager, { log, debug });

// ── Mount MCP API routes ─────────────────────────────
const { router: mcpApiRouter, recordToolCall } = createMcpApiRoutes({
  getConfig, updateConfig, mcpClientManager, log, debug
});

app.use(express.json({ limit: '5mb' }));

// ── Security Event Logger ────────────────────────────
function logSecurity(event, details = {}) {
  log('SECURITY', `[${event}] ${JSON.stringify({ ...details, ip: details.ip || 'local', ts: new Date().toISOString() })}`);
}

// ── Security Headers & CORS ─────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "http://localhost:*", "http://127.0.0.1:*", "https://prod.spline.design"],
      imgSrc: ["'self'", "data:", "blob:"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow Spline 3D scenes
}));
app.use(cors({ origin: (_origin, cb) => cb(null, true), credentials: true })); // Allow same-host origins

// When serving HTTP only, clear HSTS so browsers don't upgrade to HTTPS
app.use((_req, res, next) => {
  if (!useHttps && _req.get('x-forwarded-proto') !== 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=0');
  }
  next();
});

// Serve Vite production build (dist/) if available, fallback to legacy public/
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');
const staticDir = fs.existsSync(distDir) ? distDir : publicDir;
app.use(express.static(staticDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  }
}));

// ── Request logging middleware ───────────────────────

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('INFO', `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });
  next();
});

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
const CHAT_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_CHAT || 30);
const CREATE_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_CREATE || 12);
const GITHUB_CLONE_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_GITHUB_CLONE || 6);
const MCP_TEST_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_MCP_TEST || 12);
const REVIEW_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_REVIEW || 20);
const SCORE_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_SCORE || 20);
const MEMORY_RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX_MEMORY || 30);

app.use('/api/chat', createRateLimiter({ name: 'chat', max: CHAT_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/create-project', createRateLimiter({ name: 'create-project', max: CREATE_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/build-project', createRateLimiter({ name: 'build-project', max: CREATE_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/build/projects', createRateLimiter({ name: 'build-registry', max: CREATE_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST', 'DELETE'] }));
app.use('/api/github/clone', createRateLimiter({ name: 'github-clone', max: GITHUB_CLONE_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/mcp/clients/test-connection', createRateLimiter({ name: 'mcp-test-connection', max: MCP_TEST_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/review', createRateLimiter({ name: 'review', max: REVIEW_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/pentest', createRateLimiter({ name: 'pentest', max: REVIEW_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/score', createRateLimiter({ name: 'score', max: SCORE_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/tutorial-suggestions', createRateLimiter({ name: 'tutorial-suggestions', max: 20, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST'] }));
app.use('/api/memory', createRateLimiter({ name: 'memory', max: MEMORY_RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS, methods: ['POST', 'PUT', 'DELETE'] }));

// ── MCP Management API routes ────────────────────────
app.use('/api', mcpApiRouter);

// ── GET /api/config ──────────────────────────────────

app.get('/api/config', (req, res) => {
  debug('Config requested');
  const config = sanitizeConfigForClient(getConfig());
  // Don't serve a stale projectFolder that no longer exists on disk
  if (config.projectFolder && !fs.existsSync(config.projectFolder)) {
    config.projectFolder = '';
  }
  res.json(config);
});

// ── POST /api/config ─────────────────────────────────

app.post('/api/config', (req, res) => {
  const { ollamaUrl, projectFolder } = req.body;
  const config = getConfig();

  // Brand assets
  if (req.body.brandAssets !== undefined) {
    config.brandAssets = Array.isArray(req.body.brandAssets) ? req.body.brandAssets : [];
    log('INFO', `Brand assets updated: ${config.brandAssets.length} item(s)`);
  }

  if (ollamaUrl) {
    config.ollamaUrl = ollamaUrl.replace(/\/+$/, '');
    log('INFO', `Ollama URL changed to: ${config.ollamaUrl}`);
  }
  if (projectFolder !== undefined) {
    if (projectFolder) {
      log('INFO', `Config projectFolder received: "${projectFolder}"`);
      const resolvedFolder = resolveFolder(projectFolder);
      if (!resolvedFolder) {
        return res.status(400).json({ error: 'Folder does not exist' });
      }
      const stat = fs.statSync(resolvedFolder);
      if (!stat.isDirectory()) {
        return res.status(400).json({ error: 'projectFolder must be a directory' });
      }
      // F-01 fix: restrict to allowed roots (same as Create/Build scaffold)
      const { getWritableRoots, isUnderRoot } = require('./lib/icm-scaffolder');
      const allowedRoots = getWritableRoots(config);
      if (!isUnderRoot(resolvedFolder, allowedRoots)) {
        log('WARN', `Blocked projectFolder outside allowed roots: ${resolvedFolder}`);
        return res.status(403).json({ error: 'Folder is outside allowed directories' });
      }
      config.projectFolder = resolvedFolder;
    } else {
      config.projectFolder = '';
    }
    log('INFO', `Project folder set to: ${config.projectFolder || '(none)'}`);
  }

  updateConfig(config);
  res.json(sanitizeConfigForClient(getConfig()));
});

// ── GET /api/models ──────────────────────────────────

app.get('/api/models', async (req, res) => {
  const config = getConfig();
  const url = `${config.ollamaUrl}/api/tags`;
  debug('Fetching models', { url });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const models = await listModels(config.ollamaUrl);
    clearTimeout(timeout);

    log('INFO', `Models loaded: ${models.length} found`);
    debug('Model list', models.map(m => m.name));
    res.json({ models, ollamaUrl: config.ollamaUrl, connected: true });
  } catch (err) {
    log('ERROR', `Cannot reach Ollama at ${url}`, { error: err.message, cause: err.cause?.message });
    res.status(503).json({
      error: 'Cannot reach Ollama',
      detail: err.message,
      ollamaUrl: config.ollamaUrl,
      connected: false
    });
  }
});

// ── POST /api/chat (SSE streaming + tool-call loop) ────

app.post('/api/chat', async (req, res) => {
  const { model, messages, mode } = req.body;

  if (!model || !messages || !mode) {
    log('ERROR', 'Chat request missing fields', { model: !!model, messages: !!messages, mode: !!mode });
    return res.status(400).json({ error: 'Missing model, messages, or mode' });
  }

  const systemPrompt = SYSTEM_PROMPTS[mode];
  if (!systemPrompt) {
    log('ERROR', `Unknown mode: ${mode}`);
    return res.status(400).json({ error: `Unknown mode: ${mode}` });
  }

  log('INFO', `Chat request: model=${model} mode=${mode} messages=${messages.length}`);

  const config = getConfig();

  // Append brand assets context if configured
  const brandAssets = config.brandAssets || [];
  const brandPrompt = brandAssets.length > 0
    ? `\n\n---\nBRAND ASSETS: The user has configured these brand/logo/image files. Use them when creating, building, generating reports, or producing diagrams that need branding:\n${brandAssets.map(a => `- ${a.label || 'Asset'}: ${a.path}${a.description ? ' — ' + a.description : ''}`).join('\n')}`
    : '';

  // Inject project folder context so the AI knows what files exist
  let projectPrompt = '';
  if (config.projectFolder && fs.existsSync(config.projectFolder)) {
    try {
      const { tree } = buildFileTree(config.projectFolder, 3);
      function flattenTree(nodes, prefix = '') {
        let lines = [];
        for (const n of nodes || []) {
          if (n.type === 'file') lines.push(prefix + n.path);
          else lines.push(...flattenTree(n.children, prefix));
        }
        return lines;
      }
      const fileList = flattenTree(tree);
      if (fileList.length > 0) {
        projectPrompt = `\n\n---\nPROJECT FOLDER: ${config.projectFolder}\nFiles available (user can attach any of these for you to read):\n${fileList.slice(0, 200).join('\n')}${fileList.length > 200 ? `\n... and ${fileList.length - 200} more` : ''}`;
      }
    } catch {}
  }

  // Append external tool descriptions if any MCP clients are connected
  const toolsPrompt = toolCallHandler.buildToolsPrompt();
  const hasExternalTools = toolsPrompt.length > 0;

  // ── Memory injection (Phase 3) ──
  let memoryPrompt = '';
  let memoryMeta = null;
  if (config.memory?.enabled) {
    try {
      const embModel = config.memory.embeddingModel || 'nomic-embed-text';
      const ctx = await buildMemoryContext(config.ollamaUrl, embModel, messages, config);
      memoryPrompt = ctx.prompt;
      memoryMeta = ctx.memories;
    } catch (err) {
      log('WARN', 'Memory retrieval failed, proceeding without', { error: err.message });
    }
  }

  const enrichedSystemPrompt = systemPrompt + brandPrompt + projectPrompt + memoryPrompt + toolsPrompt;

  if (hasExternalTools) {
    debug('External tools injected into system prompt', { toolsLength: toolsPrompt.length });
  }

  const fullMessages = [
    { role: 'system', content: enrichedSystemPrompt },
    ...messages
  ];

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Helper: send SSE event
  function sendEvent(data) {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Send memory context metadata before streaming tokens
  if (memoryMeta?.length > 0) {
    sendEvent({
      memoryContext: {
        count: memoryMeta.length,
        items: memoryMeta.map(m => ({ type: m.type, content: m.content }))
      }
    });
  }

  try {
    debug('Calling Ollama chat', { url: config.ollamaUrl, model, hasExternalTools });

    // ── Tool-call loop (when external tools are connected) ──
    // Use chatComplete for rounds that may contain tool calls, then stream the final response.
    if (hasExternalTools) {
      let loopMessages = [...fullMessages];
      const MAX_ROUNDS = 5;
      let finalText = '';

      for (let round = 0; round < MAX_ROUNDS; round++) {
        debug(`Tool-call round ${round + 1}/${MAX_ROUNDS}`);

        let responseText;
        try {
          responseText = await chatComplete(config.ollamaUrl, model, loopMessages);
        } catch (err) {
          log('ERROR', `Ollama chatComplete failed (round ${round + 1})`, { error: err.message });
          sendEvent({ error: `Ollama error: ${err.message}` });
          res.write('data: [DONE]\n\n');
          return res.end();
        }

        // Check for tool calls
        debug('Ollama response (first 500 chars)', { text: responseText.substring(0, 500) });
        const toolCalls = toolCallHandler.parseToolCalls(responseText);

        if (toolCalls.length === 0) {
          // No tool calls — this is the final response
          debug('No TOOL_CALL patterns found, returning as final text');
          finalText = responseText;
          break;
        }

        // Execute tool calls and build results
        log('INFO', `Round ${round + 1}: found ${toolCalls.length} tool call(s)`);
        sendEvent({ toolCallRound: round + 1, toolCalls: toolCalls.map(t => `${t.serverId}.${t.toolName}`) });

        let toolResults = '';
        for (const call of toolCalls) {
          debug('Executing tool call', { server: call.serverId, tool: call.toolName });
          const result = await toolCallHandler.executeTool(call.serverId, call.toolName, call.args);
          if (result.success) {
            const parts = result.result?.content || [];
            const textParts = parts.filter(c => c.type === 'text').map(c => c.text);
            const imageParts = parts.filter(c => c.type === 'image');
            let content = textParts.join('\n') || JSON.stringify(result.result);
            // Embed images as markdown with base64 data URLs
            for (const img of imageParts) {
              const mimeType = img.mimeType || 'image/png';
              const data = img.data; // base64
              if (data) {
                content += `\n\n![Generated Image](data:${mimeType};base64,${data})\n`;
              }
            }
            toolResults += `\nTool ${call.serverId}.${call.toolName} returned:\n${content}\n`;
          } else {
            toolResults += `\nTool ${call.serverId}.${call.toolName} failed: ${result.error}\n`;
          }
        }

        // Feed tool results back as assistant + tool-result messages
        loopMessages.push({ role: 'assistant', content: responseText });
        loopMessages.push({ role: 'user', content: `Tool results:${toolResults}\n\nPlease continue your response using these results.` });
      }

      // Stream the final text as SSE tokens (word by word for UX)
      if (finalText) {
        const words = finalText.split(/(\s+)/);
        for (const word of words) {
          sendEvent({ token: word });
        }
        sendEvent({ done: true });
      }
      res.write('data: [DONE]\n\n');
      res.end();
      log('INFO', `Chat complete (tool-call mode): ${finalText.length} chars`);
      return;
    }

    // ── Standard streaming path (no external tools) ──
    const ollamaRes = await chatStream(config.ollamaUrl, model, fullMessages);

    debug('Ollama chat response', { status: ollamaRes.status, ok: ollamaRes.ok });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      log('ERROR', `Ollama chat error: ${ollamaRes.status}`, { body: errText });
      sendEvent({ error: `Ollama error: ${ollamaRes.status} ${errText}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;

    debug('Starting stream read loop');

    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            debug('Stream ended', { tokensStreamed: tokenCount });
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer);
                if (parsed.message?.content) {
                  sendEvent({ token: parsed.message.content });
                  tokenCount++;
                }
                if (parsed.done) {
                  sendEvent({ done: true, total_duration: parsed.total_duration, eval_count: parsed.eval_count });
                }
              } catch (e) {
                debug('Failed to parse final buffer', { buffer, error: e.message });
              }
            }
            if (!res.writableEnded) {
              res.write('data: [DONE]\n\n');
              res.end();
            }
            log('INFO', `Chat complete: ${tokenCount} tokens streamed`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
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
                debug('Ollama signaled done', { total_duration: parsed.total_duration, eval_count: parsed.eval_count });
                sendEvent({ done: true, total_duration: parsed.total_duration, eval_count: parsed.eval_count });
                res.write('data: [DONE]\n\n');
                res.end();
                log('INFO', `Chat complete: ${tokenCount} tokens streamed`);
                return;
              }
            } catch (e) {
              debug('Failed to parse stream chunk', { line: line.substring(0, 100), error: e.message });
            }
          }
        }
      } catch (err) {
        log('ERROR', 'Stream read error', { error: err.message });
        if (!res.writableEnded) {
          sendEvent({ error: err.message });
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    }

    readStream();

    req.on('close', () => {
      debug('Client disconnected during stream');
      reader.cancel().catch(() => {});
    });

  } catch (err) {
    log('ERROR', `Chat connection failed`, { error: err.message, cause: err.cause?.message });
    sendEvent({ error: `Connection failed: ${err.message}` });
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ── POST /api/review (structured report card) ────────

app.post('/api/review', async (req, res) => {
  const { model, code, filename } = req.body;

  if (!model || !code) {
    log('ERROR', 'Review request missing fields', { model: !!model, code: !!code });
    return res.status(400).json({ error: 'Missing model or code' });
  }

  log('INFO', `Review request: model=${model} code=${code.length} chars`);

  const config = getConfig();

  try {
    const result = await reviewCode(config.ollamaUrl, model, code, { filename });

    if (result.type === 'report-card') {
      // Structured output succeeded — return JSON
      log('INFO', `Review complete: overall grade ${result.data.overallGrade}`);
      return res.json(result);
    }

    // Chat fallback — stream via SSE
    log('INFO', `Review fallback to chat mode: ${result.error}`);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    function sendEvent(data) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // Signal fallback mode to client
    sendEvent({ fallback: true, reason: result.error });

    const ollamaRes = result.stream;
    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      log('ERROR', `Ollama fallback error: ${ollamaRes.status}`, { body: errText });
      sendEvent({ error: `Ollama error: ${ollamaRes.status} ${errText}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Stream the fallback response (same pattern as /api/chat)
    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;

    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer);
                if (parsed.message?.content) {
                  sendEvent({ token: parsed.message.content });
                  tokenCount++;
                }
                if (parsed.done) {
                  sendEvent({ done: true });
                }
              } catch (e) { /* ignore parse error on final buffer */ }
            }
            if (!res.writableEnded) {
              res.write('data: [DONE]\n\n');
              res.end();
            }
            log('INFO', `Review fallback complete: ${tokenCount} tokens streamed`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
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
                sendEvent({ done: true });
                res.write('data: [DONE]\n\n');
                res.end();
                log('INFO', `Review fallback complete: ${tokenCount} tokens streamed`);
                return;
              }
            } catch (e) { /* ignore parse error */ }
          }
        }
      } catch (err) {
        log('ERROR', 'Review fallback stream error', { error: err.message });
        if (!res.writableEnded) {
          sendEvent({ error: err.message });
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    }

    readStream();

    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

  } catch (err) {
    log('ERROR', 'Review failed completely', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: `Review failed: ${err.message}` });
    }
  }
});

// ── POST /api/pentest (OWASP security analysis) ────────
app.post('/api/pentest', async (req, res) => {
  const { model, code, filename } = req.body;

  if (!model || !code) {
    log('ERROR', 'Pentest request missing fields', { model: !!model, code: !!code });
    return res.status(400).json({ error: 'Missing model or code' });
  }

  log('INFO', `Pentest request: model=${model} code=${code.length} chars`);

  const config = getConfig();

  try {
    const result = await pentestCode(config.ollamaUrl, model, code, { filename });

    if (result.type === 'security-report') {
      // Structured output succeeded — return JSON
      log('INFO', `Pentest complete: overall grade ${result.data.overallGrade}`);
      return res.json(result);
    }

    // Chat fallback — stream via SSE
    log('INFO', `Pentest fallback to chat mode: ${result.error}`);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    function sendEvent(data) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    // Signal fallback mode to client
    sendEvent({ fallback: true, reason: result.error });

    const ollamaRes = result.stream;
    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      log('ERROR', `Ollama pentest fallback error: ${ollamaRes.status}`, { body: errText });
      sendEvent({ error: `Ollama error: ${ollamaRes.status} ${errText}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Stream the fallback response (same pattern as /api/review)
    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;

    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer);
                if (parsed.message?.content) {
                  sendEvent({ token: parsed.message.content });
                  tokenCount++;
                }
                if (parsed.done) {
                  sendEvent({ done: true });
                }
              } catch (e) { /* ignore parse error on final buffer */ }
            }
            if (!res.writableEnded) {
              res.write('data: [DONE]\n\n');
              res.end();
            }
            log('INFO', `Pentest fallback complete: ${tokenCount} tokens streamed`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
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
                sendEvent({ done: true });
                res.write('data: [DONE]\n\n');
                res.end();
                log('INFO', `Pentest fallback complete: ${tokenCount} tokens streamed`);
                return;
              }
            } catch (e) { /* ignore parse error */ }
          }
        }
      } catch (err) {
        log('ERROR', 'Pentest fallback stream error', { error: err.message });
        if (!res.writableEnded) {
          sendEvent({ error: err.message });
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }
    }

    readStream();

    req.on('close', () => {
      reader.cancel().catch(() => {});
    });

  } catch (err) {
    log('ERROR', 'Pentest failed completely', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: `Pentest failed: ${err.message}` });
    }
  }
});

// ── POST /api/pentest/remediate (generate fixed code from findings) ──
app.post('/api/pentest/remediate', async (req, res) => {
  const { model, code, filename, findings } = req.body;

  if (!model || !code || !findings) {
    return res.status(400).json({ error: 'Missing model, code, or findings' });
  }

  const config = getConfig();
  log('INFO', `Remediate request: model=${model} code=${code.length} chars`);

  const systemPrompt = `You are a senior security engineer. The user will provide code that was scanned for security vulnerabilities, along with the findings. Your job is to:

1. First, output a REMEDIATION REPORT section in markdown explaining each fix you will make, why it matters, and the OWASP category it addresses.
2. Then, output the COMPLETE revised/fixed file(s) with all security vulnerabilities remediated. Include the full file content, not just snippets.

Format your response EXACTLY as follows:

# Remediation Report
(your detailed technical writeup here)

---REVISED_FILES---
---FILE: filename.ext---
(complete fixed file content here)
---END_FILE---

If there are multiple files, repeat the FILE/END_FILE block for each.
Important: Include the COMPLETE file content in each block, not just the changed lines.`;

  const userContent = `Here is the code to remediate:\n\nFilename: ${filename || 'unknown'}\n\n\`\`\`\n${code}\n\`\`\`\n\nSecurity findings:\n${findings}`;

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    function sendEvent(data) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    const ollamaRes = await chatStream(config.ollamaUrl, model, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]);

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      sendEvent({ error: `Ollama error: ${ollamaRes.status} ${errText}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;

    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer);
                if (parsed.message?.content) { sendEvent({ token: parsed.message.content }); tokenCount++; }
              } catch {}
            }
            if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); }
            log('INFO', `Remediate complete: ${tokenCount} tokens`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) { sendEvent({ token: parsed.message.content }); tokenCount++; }
              if (parsed.done) {
                sendEvent({ done: true });
                res.write('data: [DONE]\n\n');
                res.end();
                log('INFO', `Remediate complete: ${tokenCount} tokens`);
                return;
              }
            } catch {}
          }
        }
      } catch (err) {
        if (!res.writableEnded) { sendEvent({ error: err.message }); res.write('data: [DONE]\n\n'); res.end(); }
      }
    }

    readStream();
    req.on('close', () => { reader.cancel().catch(() => {}); });

  } catch (err) {
    log('ERROR', 'Remediate failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: `Remediate failed: ${err.message}` });
    }
  }
});

// ── POST /api/pentest/folder/preview (list files that would be scanned) ──
app.post('/api/pentest/folder/preview', async (req, res) => {
  const { folder } = req.body;
  if (!folder) return res.status(400).json({ error: 'Missing folder' });

  try {
    const { files, totalSize, skipped } = readFolderFiles(folder, {
      maxFiles: 80,
      maxTotalSize: 2 * 1024 * 1024,
    });
    res.json({
      files: files.map(f => ({ path: f.path, size: f.size })),
      totalSize,
      skipped,
      folder,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/pentest/folder (scan a folder recursively) ──
app.post('/api/pentest/folder', async (req, res) => {
  const { model, folder } = req.body;

  if (!model || !folder) {
    return res.status(400).json({ error: 'Missing model or folder' });
  }

  const config = getConfig();

  try {
    const { files, totalSize, skipped } = readFolderFiles(folder, {
      maxFiles: 80,
      maxTotalSize: 2 * 1024 * 1024,
    });

    if (files.length === 0) {
      return res.status(400).json({ error: 'No scannable text files found in folder' });
    }

    log('INFO', `Pentest folder: ${folder} — ${files.length} files, ${(totalSize / 1024).toFixed(1)}KB${skipped ? `, ${skipped} skipped` : ''}`);

    const result = await pentestFolder(config.ollamaUrl, model, files, {});

    if (result.type === 'security-report') {
      log('INFO', `Pentest folder complete: overall grade ${result.data.overallGrade}`);
      return res.json({ ...result, meta: { fileCount: files.length, totalSize, skipped, folder } });
    }

    // Chat fallback — stream via SSE
    log('INFO', `Pentest folder fallback to chat mode: ${result.error}`);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    function sendEvent(data) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    sendEvent({ fallback: true, reason: result.error, meta: { fileCount: files.length, totalSize, skipped } });

    const ollamaRes = result.stream;
    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      sendEvent({ error: `Ollama error: ${ollamaRes.status} ${errText}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;

    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer);
                if (parsed.message?.content) { sendEvent({ token: parsed.message.content }); tokenCount++; }
                if (parsed.done) sendEvent({ done: true });
              } catch {}
            }
            if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); }
            log('INFO', `Pentest folder fallback complete: ${tokenCount} tokens`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) { sendEvent({ token: parsed.message.content }); tokenCount++; }
              if (parsed.done) {
                sendEvent({ done: true });
                res.write('data: [DONE]\n\n');
                res.end();
                return;
              }
            } catch {}
          }
        }
      } catch (err) {
        if (!res.writableEnded) { sendEvent({ error: err.message }); res.write('data: [DONE]\n\n'); res.end(); }
      }
    }

    readStream();
    req.on('close', () => { reader.cancel().catch(() => {}); });

  } catch (err) {
    log('ERROR', 'Pentest folder failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: `Pentest folder failed: ${err.message}` });
    }
  }
});

// ── POST /api/validate/scan (discover validation tools in a project) ──
app.post('/api/validate/scan', async (req, res) => {
  const { folder } = req.body;
  if (!folder) return res.status(400).json({ error: 'Missing folder' });

  try {
    const result = scanProjectForValidation(folder);
    log('INFO', `Validate scan: ${folder} — lang=${result.language} framework=${result.framework}`);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── POST /api/validate/generate (generate validate.md via AI) ──
app.post('/api/validate/generate', async (req, res) => {
  const { model, folder, scanResult } = req.body;
  if (!model || !folder || !scanResult) {
    return res.status(400).json({ error: 'Missing model, folder, or scanResult' });
  }

  const config = getConfig();
  log('INFO', `Validate generate: model=${model} folder=${folder}`);

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    function sendEvent(data) {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
    }

    const ollamaRes = await generateValidateCommand(config.ollamaUrl, model, folder, scanResult);

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      sendEvent({ error: `Ollama error: ${ollamaRes.status} ${errText}` });
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;

    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.trim()) {
              try {
                const parsed = JSON.parse(buffer);
                if (parsed.message?.content) { sendEvent({ token: parsed.message.content }); tokenCount++; }
              } catch {}
            }
            if (!res.writableEnded) { res.write('data: [DONE]\n\n'); res.end(); }
            log('INFO', `Validate generate complete: ${tokenCount} tokens`);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const parsed = JSON.parse(line);
              if (parsed.message?.content) { sendEvent({ token: parsed.message.content }); tokenCount++; }
              if (parsed.done) {
                sendEvent({ done: true });
                res.write('data: [DONE]\n\n');
                res.end();
                log('INFO', `Validate generate complete: ${tokenCount} tokens`);
                return;
              }
            } catch {}
          }
        }
      } catch (err) {
        if (!res.writableEnded) { sendEvent({ error: err.message }); res.write('data: [DONE]\n\n'); res.end(); }
      }
    }

    readStream();
    req.on('close', () => { reader.cancel().catch(() => {}); });

  } catch (err) {
    log('ERROR', 'Validate generate failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: `Validate generate failed: ${err.message}` });
    }
  }
});

// ── POST /api/validate/install (write validate.md to IDE command path) ──
app.post('/api/validate/install', (req, res) => {
  const { projectFolder, content, targets } = req.body;
  // targets is an array of relative paths like ['.claude/commands/validate.md', ...]

  if (!projectFolder || !content || !targets?.length) {
    return res.status(400).json({ error: 'Missing projectFolder, content, or targets' });
  }

  const absFolder = path.resolve(projectFolder);
  if (!fs.existsSync(absFolder)) {
    return res.status(400).json({ error: 'Project folder not found' });
  }

  const results = [];
  for (const target of targets) {
    const targetPath = path.join(absFolder, target);
    // Security: ensure it's within the project folder
    if (!targetPath.startsWith(absFolder + path.sep) && targetPath !== absFolder) {
      results.push({ target, success: false, error: 'Path traversal blocked' });
      continue;
    }
    try {
      const dir = path.dirname(targetPath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(targetPath, content, 'utf8');
      results.push({ target, success: true });
      log('INFO', `Validate installed: ${targetPath}`);
    } catch (err) {
      results.push({ target, success: false, error: err.message });
    }
  }

  res.json({ results, installed: results.filter(r => r.success).length });
});

// ── POST /api/score (builder mode scoring) ────────────

app.post('/api/score', async (req, res) => {
  const { model, mode, content, metadata } = req.body;

  if (!model || !content || !mode) {
    return res.status(400).json({ error: 'model, mode, and content are required' });
  }

  const validModes = ['prompting', 'skillz', 'agentic'];
  if (!validModes.includes(mode)) {
    return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
  }

  log('INFO', `Score request: model=${model} mode=${mode} content=${content.length} chars`);

  try {
    const config = getConfig();
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
    const result = await scoreContent(ollamaUrl, model, mode, content, metadata);

    if (result.type === 'score-card') {
      log('INFO', `Score complete: overall grade ${result.data?.overallGrade || 'N/A'}`);
      return res.json(result);
    }

    // Fallback: stream response
    if (result.type === 'chat-fallback') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const sendEvent = (data) => {
        if (!res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      sendEvent({ fallback: true, reason: result.error });

      // Stream the response (result.stream is a fetch Response)
      const ollamaRes = result.stream;
      if (!ollamaRes || typeof ollamaRes.ok !== 'boolean') {
        log('ERROR', 'Score fallback: invalid stream (not a Response)', { hasStream: !!result.stream });
        sendEvent({ error: 'Invalid response from model' });
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      if (!ollamaRes.ok) {
        const errText = await ollamaRes.text();
        log('ERROR', `Ollama score fallback error: ${ollamaRes.status}`, { body: errText });
        sendEvent({ error: `Ollama error: ${ollamaRes.status} ${errText}` });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      const body = ollamaRes.body;
      if (!body || typeof body.getReader !== 'function') {
        log('ERROR', 'Score fallback: response has no readable body', { hasBody: !!body });
        sendEvent({ error: 'Model returned a response that cannot be streamed' });
        res.write('data: [DONE]\n\n');
        return res.end();
      }

      // Use Readable.fromWeb for robust consumption (avoids "not async iterable" with some Node/cloud responses)
      const nodeStream = Readable.fromWeb(body);
      const decoder = new TextDecoder();
      let buf = '';
      for await (const chunk of nodeStream) {
        buf += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : decoder.decode(chunk);
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) sendEvent({ token: parsed.message.content });
            if (parsed.done) sendEvent({ done: true });
          } catch {}
        }
      }
      if (buf.trim()) {
        try {
          const parsed = JSON.parse(buf);
          if (parsed.message?.content) sendEvent({ token: parsed.message.content });
          if (parsed.done) sendEvent({ done: true });
        } catch {}
      }
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (err) {
    log('ERROR', 'Score endpoint failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ── Cross-platform IDE launching ─────────────────────

// Try to load the Electron IDE launcher if available (in Electron mode)
let ideLauncher = null;
try {
  if (process.env.CC_DATA_DIR || process.versions.electron) {
    ideLauncher = require('./electron/ide-launcher');
  }
} catch (err) {
  // Not in Electron mode or module not found - will use legacy macOS commands
  console.log('[IDE Launcher] Running in dev mode, using macOS-only commands');
}

// ── Launch Claude Code in Terminal ────────────────────

// F-06 fix: validate folder path for IDE launch — reject dangerous characters
function _validateIDEFolder(folder) {
  if (!folder || typeof folder !== 'string') return false;
  // Reject newlines, semicolons, pipes, backticks, $() — shell metacharacters
  if (/[\n\r;|`$]/.test(folder)) return false;
  return fs.existsSync(folder);
}

app.post('/api/launch-claude-code', async (req, res) => {
  const { projectPath } = req.body;
  const folder = projectPath || getConfig().projectFolder;
  if (!folder) return res.status(400).json({ error: 'No project folder specified' });
  if (!_validateIDEFolder(folder)) return res.status(400).json({ error: 'Invalid folder path' });

  try {
    if (ideLauncher) {
      await ideLauncher.launchIDE('claude-code', folder);
      log('INFO', `Launched Claude Code in: ${folder}`);
      res.json({ success: true, folder });
    } else {
      // F-06 fix: use execFile with args array instead of shell string interpolation
      const { execFile } = require('child_process');
      execFile('open', ['-a', 'Terminal', folder], { stdio: 'ignore' }, () => {});
      log('INFO', `Launched Claude Code in: ${folder} (macOS only)`);
      res.json({ success: true, folder });
    }
  } catch (err) {
    log('ERROR', 'launch-claude-code failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Launch Cursor in project folder ──────────────────

app.post('/api/launch-cursor', async (req, res) => {
  const { projectPath } = req.body;
  const folder = projectPath || getConfig().projectFolder;
  if (!folder) return res.status(400).json({ error: 'No project folder specified' });
  if (!_validateIDEFolder(folder)) return res.status(400).json({ error: 'Invalid folder path' });

  try {
    if (ideLauncher) {
      await ideLauncher.launchIDE('cursor', folder);
      log('INFO', `Launched Cursor in: ${folder}`);
      res.json({ success: true, folder });
    } else {
      const cursorCli = '/Applications/Cursor.app/Contents/Resources/app/bin/cursor';
      if (fs.existsSync(cursorCli)) {
        const { execFile } = require('child_process');
        execFile(cursorCli, [folder], { detached: true, stdio: 'ignore' }).unref();
      } else {
        const { execSync } = require('child_process');
        execSync(`open -a "Cursor" "${folder}"`);
      }
      log('INFO', `Launched Cursor in: ${folder} (macOS only)`);
      res.json({ success: true, folder });
    }
  } catch (err) {
    log('ERROR', 'launch-cursor failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Launch Windsurf in project folder ─────────────────

app.post('/api/launch-windsurf', async (req, res) => {
  const { projectPath } = req.body;
  const folder = projectPath || getConfig().projectFolder;
  if (!folder) return res.status(400).json({ error: 'No project folder specified' });
  if (!_validateIDEFolder(folder)) return res.status(400).json({ error: 'Invalid folder path' });

  try {
    if (ideLauncher) {
      await ideLauncher.launchIDE('windsurf', folder);
      log('INFO', `Launched Windsurf in: ${folder}`);
      res.json({ success: true, folder });
    } else {
      const { execFile } = require('child_process');
      const windsurfCli = '/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf';
      if (fs.existsSync(windsurfCli)) {
        execFile(windsurfCli, [folder], { detached: true, stdio: 'ignore' }).unref();
      } else {
        const { execSync } = require('child_process');
        execSync(`open -a "Windsurf" "${folder}"`);
      }
      log('INFO', `Launched Windsurf in: ${folder} (macOS only)`);
      res.json({ success: true, folder });
    }
  } catch (err) {
    log('ERROR', 'launch-windsurf failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Launch OpenCode in project folder ─────────────────

app.post('/api/launch-opencode', async (req, res) => {
  const { projectPath } = req.body;
  const folder = projectPath || getConfig().projectFolder;
  if (!folder) return res.status(400).json({ error: 'No project folder specified' });
  if (!_validateIDEFolder(folder)) return res.status(400).json({ error: 'Invalid folder path' });

  try {
    if (ideLauncher) {
      await ideLauncher.launchIDE('opencode', folder);
      log('INFO', `Launched OpenCode in: ${folder}`);
      res.json({ success: true, folder });
    } else {
      // F-06 fix: use execFile instead of shell string interpolation
      const { execFile } = require('child_process');
      execFile('open', ['-a', 'Terminal', folder], { stdio: 'ignore' }, () => {});
      log('INFO', `Launched OpenCode in: ${folder} (macOS only)`);
      res.json({ success: true, folder });
    }
  } catch (err) {
    log('ERROR', 'launch-opencode failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── Conversation History ─────────────────────────────

app.get('/api/history', (req, res) => {
  try {
    const conversations = listConversations();
    res.json(conversations);
  } catch (err) {
    log('ERROR', 'Failed to load history', { error: err.message });
    res.json([]);
  }
});

app.get('/api/history/:id', (req, res) => {
  try {
    const data = getConversation(req.params.id);
    res.json(data);
  } catch (err) {
    const status = err.message.includes('Invalid conversation id') ? 400 : 404;
    res.status(status).json({ error: status === 404 ? 'Not found' : err.message });
  }
});

app.post('/api/history', async (req, res) => {
  try {
    const id = saveConversation(req.body);
    debug('Conversation saved', { id });
    res.json({ id });

    // Fire-and-forget memory extraction (non-blocking — response already sent)
    const config = getConfig();
    if (config.memory?.enabled && config.memory?.autoExtract
        && req.body.messages?.length >= 4) {
      const embModel = config.memory.embeddingModel || 'nomic-embed-text';
      extractAndStore(config.ollamaUrl, req.body.model, embModel, req.body)
        .catch(err => log('WARN', 'Memory extraction failed', { error: err.message }));
    }
  } catch (err) {
    const status = err.message.includes('Invalid conversation id') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

app.delete('/api/history/:id', (req, res) => {
  try {
    deleteConversation(req.params.id);
    debug('Conversation deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    const status = err.message.includes('Invalid conversation id') ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

// ── Memory API ──────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateMemoryId(req, res) {
  const { id } = req.params;
  if (!id || !UUID_REGEX.test(id)) {
    res.status(400).json({ error: 'Invalid memory id' });
    return null;
  }
  return id;
}

app.get('/api/memory/stats', (req, res) => {
  try {
    res.json(getMemoryStats());
  } catch (err) {
    log('ERROR', 'Failed to get memory stats', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/memory/models', async (req, res) => {
  try {
    const config = getConfig();
    const models = await listModels(config.ollamaUrl);
    const embeddingModels = models.filter(m =>
      /embed|bert|minilm/i.test(m.family || '')
    );
    res.json(embeddingModels);
  } catch (err) {
    log('ERROR', 'Failed to list embedding models', { error: err.message });
    res.json([]);
  }
});

app.get('/api/memory/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || typeof q !== 'string' || !q.trim()) {
      return res.status(400).json({ error: 'Query parameter q is required' });
    }
    const config = getConfig();
    const embModel = config.memory?.embeddingModel || 'nomic-embed-text';
    const queryEmbedding = await embed(config.ollamaUrl, q.trim(), embModel);
    const results = searchMemories(queryEmbedding, 10, 0.3);
    // Strip embeddings from response to reduce payload
    const cleaned = results.map(({ embedding, ...rest }) => rest);
    res.json(cleaned);
  } catch (err) {
    log('ERROR', 'Memory search failed', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/memory', (req, res) => {
  try {
    const typeFilter = req.query.type || null;
    let memories = getMemories(typeFilter ? { type: typeFilter } : undefined);

    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const total = memories.length;
    const start = (page - 1) * limit;
    memories = memories.slice(start, start + limit);

    // Strip embeddings from response
    const cleaned = memories.map(({ embedding, ...rest }) => rest);
    res.json({ memories: cleaned, total, page, limit });
  } catch (err) {
    log('ERROR', 'Failed to list memories', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/memory', async (req, res) => {
  try {
    const { type, content, source, confidence } = req.body;
    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ error: 'content is required' });
    }
    const validTypes = ['fact', 'pattern', 'project', 'summary'];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` });
    }

    // Generate embedding
    let embeddingVec = null;
    let embModel = '';
    try {
      const config = getConfig();
      embModel = config.memory?.embeddingModel || 'nomic-embed-text';
      embeddingVec = await embed(config.ollamaUrl, content.trim(), embModel);
    } catch (embErr) {
      log('WARN', 'Embedding generation failed for new memory', { error: embErr.message });
    }

    const memory = addMemory({
      type: type || 'fact',
      content: content.trim(),
      source: source || null,
      embedding: embeddingVec,
      embeddingModel: embModel,
      confidence: typeof confidence === 'number' ? confidence : 0.5,
    });

    const { embedding, ...cleaned } = memory;
    res.json(cleaned);
  } catch (err) {
    log('ERROR', 'Failed to add memory', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/memory/:id', (req, res) => {
  const id = validateMemoryId(req, res);
  if (!id) return;

  try {
    const updated = updateMemory(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    const { embedding, ...cleaned } = updated;
    res.json(cleaned);
  } catch (err) {
    log('ERROR', 'Failed to update memory', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/memory/:id', (req, res) => {
  const id = validateMemoryId(req, res);
  if (!id) return;

  try {
    const deleted = deleteMemory(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    log('ERROR', 'Failed to delete memory', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ── File Browser API ─────────────────────────────────

// Search common directories for a folder by name (1-2 levels deep)
function findFolderByName(name) {
  const searchRoots = [
    os.homedir(),
    path.join(os.homedir(), 'AI_Dev'),
    path.join(os.homedir(), 'Projects'),
    path.join(os.homedir(), 'Developer'),
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Desktop'),
    __dirname,
  ];
  for (const root of searchRoots) {
    const candidate = path.join(root, name);
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    } catch {}
  }
  // Second pass: check one level deeper in each root
  for (const root of searchRoots) {
    try {
      if (!fs.existsSync(root)) continue;
      const children = fs.readdirSync(root, { withFileTypes: true });
      for (const child of children) {
        if (!child.isDirectory()) continue;
        const candidate = path.join(root, child.name, name);
        try {
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
        } catch {}
      }
    } catch {}
  }
  return null;
}

// Resolve a folder path: expand ~, resolve relative, search by name if needed
function resolveFolder(folder) {
  if (folder.startsWith('~')) folder = path.join(os.homedir(), folder.slice(1));
  folder = path.resolve(folder);
  if (fs.existsSync(folder)) return folder;
  return findFolderByName(path.basename(folder));
}

// GET /api/files/tree — list directory structure
app.get('/api/files/tree', (req, res) => {
  const config = getConfig();
  let folder = req.query.folder || config.projectFolder;
  if (!folder) return res.status(400).json({ error: 'No project folder configured' });
  folder = resolveFolder(folder);
  if (!folder) return res.status(404).json({ error: 'Folder not found' });

  const depth = Number.parseInt(req.query.depth, 10);
  const maxDepth = Number.isNaN(depth) ? 3 : Math.min(Math.max(depth, 1), 6);

  try {
    debug('Building file tree', { folder, maxDepth });
    const result = buildFileTree(folder, maxDepth);
    res.json(result);
  } catch (err) {
    log('ERROR', 'Failed to build file tree', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/read — read file contents (folder from config, or optional query param for validation/testing)
app.get('/api/files/read', (req, res) => {
  const config = getConfig();
  const filePath = req.query.path;
  let folder = req.query.folder ? path.resolve(req.query.folder) : config.projectFolder;

  if (!filePath || !folder) return res.status(400).json({ error: 'Missing path or project folder' });

  // When folder override is used, restrict to project folder or app root (for validation/same-machine use)
  if (req.query.folder) {
    const allowedRoots = [config.projectFolder, __dirname].filter(Boolean);
    const absFolder = path.resolve(folder);
    const allowed = allowedRoots.some(root => absFolder === path.resolve(root) || absFolder.startsWith(path.resolve(root) + path.sep));
    if (!allowed) return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const result = readProjectFile(folder, filePath);
    debug('File read', { path: filePath, size: result.size });
    res.json(result);
  } catch (err) {
    if (err.message.includes('Path traversal')) {
      log('ERROR', 'Path traversal attempt blocked', { filePath, folder });
      return res.status(403).json({ error: 'Access denied' });
    }
    const status = err.message === 'File not found' ? 404 : err.message === 'Not a file' ? 400 : 500;
    log('ERROR', 'Failed to read file', { path: filePath, error: err.message, status });
    res.status(status).json({ error: `Cannot read file: ${err.message}` });
  }
});

// POST /api/files/save — save content back to file with .bak backup
app.post('/api/files/save', (req, res) => {
  const { filePath, folder, content } = req.body;

  if (!filePath || !folder || content === undefined) {
    return res.status(400).json({ error: 'Missing filePath, folder, or content' });
  }

  try {
    const result = saveProjectFile(folder, filePath, content);
    log('INFO', 'File saved', { path: filePath, size: result.size, backedUp: result.backedUp });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.message.includes('Path traversal')) {
      log('ERROR', 'Path traversal attempt blocked on save', { filePath, folder });
      return res.status(403).json({ error: 'Access denied' });
    }
    log('ERROR', 'Failed to save file', { path: filePath, error: err.message });
    res.status(500).json({ error: `Cannot save file: ${err.message}` });
  }
});

// POST /api/files/upload — receive uploaded file content (sent as text from browser)
app.post('/api/files/upload', (req, res) => {
  const { name, content } = req.body;
  if (!name || content === undefined) return res.status(400).json({ error: 'Missing name or content' });
  debug('File uploaded via chat', { name, size: content.length });
  res.json({ name, size: content.length, content });
});

// ── POST /api/create-project (ICM scaffold) ───────────
app.post('/api/create-project', (req, res) => {
  log('INFO', 'create-project body keys: ' + Object.keys(req.body || {}).join(', '));
  const { name, description, role, audience, tone, stages, outputRoot, overwrite, makerEnabled } = req.body;
  if (!name || !outputRoot) {
    log('WARN', `create-project missing fields — name: "${name}", outputRoot: "${outputRoot}"`);
    return res.status(400).json({ success: false, error: 'name and outputRoot are required', code: 'MISSING_FIELDS' });
  }
  const config = getConfig();
  try {
    const result = scaffoldProject(
      { name, description, role, audience, tone, stages, outputRoot, overwrite: overwrite === true, makerEnabled: makerEnabled === true },
      config
    );
    if (result.success) {
      log('INFO', `ICM project created: ${result.projectPath}`);
      return res.status(201).json(result);
    }
    const code = result.code || 'SCAFFOLD_FAILED';
    const status = code === 'PATH_OUTSIDE_ROOT' ? 403 : code === 'ALREADY_EXISTS' ? 409 : 400;
    return res.status(status).json({ success: false, error: result.errors?.[0] || 'Scaffold failed', code });
  } catch (err) {
    log('ERROR', 'create-project failed', { error: err.message });
    return res.status(500).json({ success: false, error: err.message, code: 'SERVER_ERROR' });
  }
});

// ── POST /api/build-project (GSD + ICM scaffold) ─────
app.post('/api/build-project', (req, res) => {
  const { name, description, outputRoot, audience, tone, overwrite } = req.body || {};
  if (!name || !outputRoot) {
    return res.status(400).json({ success: false, error: 'name and outputRoot are required', code: 'MISSING_FIELDS' });
  }
  const config = getConfig();
  try {
    const result = scaffoldBuildProject(
      { name, description, outputRoot, audience, tone, overwrite: overwrite === true },
      config
    );
    if (result.success) {
      log('INFO', `Build project created: ${result.projectPath}`);
      return res.status(201).json(result);
    }
    const code = result.code || 'SCAFFOLD_FAILED';
    const status = code === 'PATH_OUTSIDE_ROOT' ? 403 : code === 'ALREADY_EXISTS' ? 409 : 400;
    return res.status(status).json({ success: false, error: result.errors?.[0] || 'Scaffold failed', code });
  } catch (err) {
    log('ERROR', 'build-project failed', { error: err.message });
    return res.status(500).json({ success: false, error: err.message, code: 'SERVER_ERROR' });
  }
});

// ── POST /api/tutorial-suggestions (contextual suggestions from project info) ─
app.post('/api/tutorial-suggestions', async (req, res) => {
  const { name, description, role, mode, model } = req.body || {};
  const validModes = ['create', 'build'];
  if (!mode || !validModes.includes(mode)) {
    return res.status(400).json({ error: 'mode is required and must be "create" or "build"' });
  }
  if (!name && !description) {
    return res.status(400).json({ error: 'At least one of name or description is required' });
  }
  const config = getConfig();
  const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
  const selectedModel = model || config.defaultModel || 'llama3.2';

  const prompt = `You are helping fill out a project wizard. The user has already entered:

Project name: ${(name || '').trim() || '(none)'}
Description: ${(description || '').trim() || '(none)'}
${mode === 'create' && role ? `AI role: ${role.trim()}` : ''}

Respond with ONLY a single JSON object, no markdown or explanation, with these exact keys:
- "audience": one short sentence describing who will use or benefit from this project (e.g. "Home cooks and people tracking nutrition")
- "tone": exactly one of: Friendly, Professional, Technical, Warm
- "outputRoot": a suggested parent folder path, e.g. "~/AI_Dev/"

Example: {"audience":"Developers and technical writers","tone":"Professional","outputRoot":"~/AI_Dev/"}`;

  try {
    const text = await chatComplete(ollamaUrl, selectedModel, [
      { role: 'user', content: prompt }
    ], 15000);
    const raw = text.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    const parsed = JSON.parse(raw || '{}');
    const audience = typeof parsed.audience === 'string' ? parsed.audience.trim() : null;
    const tone = typeof parsed.tone === 'string' ? parsed.tone.trim() : null;
    const outputRoot = typeof parsed.outputRoot === 'string' ? parsed.outputRoot.trim() : null;
    res.json({
      audience: audience || undefined,
      tone: tone || undefined,
      outputRoot: outputRoot || undefined
    });
  } catch (err) {
    log('WARN', 'tutorial-suggestions failed', { error: err.message });
    res.status(500).json({ error: err.message || 'Failed to generate suggestions' });
  }
});

// ── Build Dashboard API ──────────────────────────────

// Helper: resolve project from registry by ID and validate
function _resolveBuildProject(req, res) {
  const project = getProject(dataRoot, req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found in registry' });
  if (!require('fs').existsSync(project.path)) {
    return res.status(404).json({ error: 'Project directory missing', path: project.path });
  }
  return project;
}

app.get('/api/build/projects', (req, res) => {
  const projects = validateProjects(dataRoot);
  res.json(projects);
});

app.post('/api/build/projects/register', (req, res) => {
  const { name, projectPath } = req.body || {};
  if (!name || !projectPath) {
    return res.status(400).json({ error: 'name and projectPath are required' });
  }
  const id = addProject(dataRoot, { name, projectPath });
  res.json({ success: true, id });
});

// Import existing project by path (auto-scaffolds .planning/ if missing)
app.post('/api/build/projects', (req, res) => {
  const { path: importPath, name } = req.body || {};
  if (!importPath) {
    return res.status(400).json({ error: 'path is required' });
  }
  const resolved = require('path').resolve(importPath.replace(/^~/, require('os').homedir()));
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  // F-03 fix: restrict import path to allowed roots
  const { getWritableRoots, isUnderRoot } = require('./lib/icm-scaffolder');
  const config = getConfig();
  if (!isUnderRoot(resolved, getWritableRoots(config))) {
    log('WARN', `Blocked build import outside allowed roots: ${resolved}`);
    return res.status(403).json({ error: 'Path is outside allowed directories' });
  }
  const projectName = name || path.basename(resolved);
  let scaffolded = false;

  // Auto-scaffold .planning/ if missing
  if (!fs.existsSync(path.join(resolved, '.planning'))) {
    try {
      const { scaffoldPlanning } = require('./lib/build-scaffolder');
      scaffoldPlanning(resolved, projectName);
      scaffolded = true;
      log('INFO', `Auto-scaffolded .planning/ for imported project: ${resolved}`);
    } catch (err) {
      log('ERROR', `Failed to scaffold .planning/ for import: ${err.message}`);
      return res.status(500).json({ error: 'Failed to create planning structure: ' + err.message });
    }
  }

  const id = addProject(dataRoot, { name: projectName, projectPath: resolved });
  res.json({ success: true, id, scaffolded });
});

app.delete('/api/build/projects/:id', (req, res) => {
  const removed = removeProject(dataRoot, req.params.id);
  if (!removed) return res.status(404).json({ error: 'Project not found' });
  res.json({ success: true });
});

app.get('/api/build/projects/:id/state', (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  try {
    const bridge = new GsdBridge(project.path);
    res.json(bridge.getState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/build/projects/:id/roadmap', (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  try {
    const bridge = new GsdBridge(project.path);
    res.json(bridge.getRoadmap());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/build/projects/:id/progress', (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  try {
    const bridge = new GsdBridge(project.path);
    res.json(bridge.getProgress());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/build/projects/:id/phase/:n', (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  try {
    const bridge = new GsdBridge(project.path);
    res.json(bridge.getPhaseDetail(req.params.n));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/build/projects/:id/next-action — AI-powered "What's Next" recommendation
app.use('/api/build/projects/:id/next-action', createRateLimiter({ name: 'build-next-action', max: 10, windowMs: 60000, methods: ['POST'] }));
app.post('/api/build/projects/:id/next-action', async (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  try {
    const config = getConfig();
    const model = req.body.model || config.defaultModel;
    const bridge = new GsdBridge(project.path);
    const state = bridge.getState();
    const progress = bridge.getProgress();

    const stateStr = JSON.stringify(state).slice(0, 2000);
    const messages = [
      {
        role: 'system',
        content: 'You are a friendly project coach. Given the project state, suggest the single most important next action. Be concise (2-3 sentences). Use encouraging, non-technical language. If the project is complete, congratulate them.'
      },
      {
        role: 'user',
        content: `Project: ${project.name}\nProgress: ${JSON.stringify(progress)}\nState (truncated): ${stateStr}`
      }
    ];

    const result = await chatComplete(config.ollamaUrl, model, messages, 30000);
    res.json({ action: result, timestamp: new Date().toISOString() });
  } catch (err) {
    log('ERROR', `next-action failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/build/projects/:id/research — SSE stream AI research for a phase
app.use('/api/build/projects/:id/research', createRateLimiter({ name: 'build-research', max: 5, windowMs: 60000, methods: ['POST'] }));
app.post('/api/build/projects/:id/research', async (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;

  let aborted = false;
  req.on('close', () => { aborted = true; });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function sendEvent(data) {
    if (!aborted && !res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const config = getConfig();
    const model = req.body.model || config.defaultModel;
    const phaseNumber = req.body.phaseNumber;
    if (!phaseNumber) {
      sendEvent({ error: 'phaseNumber is required' });
      return res.end();
    }

    const bridge = new GsdBridge(project.path);
    const state = bridge.getState();
    const roadmap = bridge.getRoadmap();

    const stateStr = JSON.stringify(state).slice(0, 3000);
    const roadmapStr = JSON.stringify(roadmap.phases || roadmap).slice(0, 3000);

    const messages = [
      {
        role: 'system',
        content: 'You are a technical researcher preparing context for project planning. Given the project state and roadmap, research phase ' + phaseNumber + '. Identify: 1) What needs to be built, 2) Key technical decisions, 3) Dependencies and risks, 4) Suggested approach. Be thorough but concise. Use markdown formatting.'
      },
      {
        role: 'user',
        content: `Project: ${project.name}\nPhase: ${phaseNumber}\n\nState (truncated):\n${stateStr}\n\nRoadmap phases (truncated):\n${roadmapStr}`
      }
    ];

    const result = await chatComplete(config.ollamaUrl, model, messages, 180000);

    // Stream result progressively as words
    const words = result.split(/(\s+)/);
    for (const word of words) {
      if (aborted) break;
      sendEvent({ token: word });
    }

    if (!aborted) sendEvent({ done: true });
  } catch (err) {
    log('ERROR', `build-research failed: ${err.message}`);
    sendEvent({ error: err.message });
  }
  if (!res.writableEnded) res.end();
});

// POST /api/build/projects/:id/plan — SSE stream AI plan for a phase with write-after-validate
app.use('/api/build/projects/:id/plan', createRateLimiter({ name: 'build-plan', max: 5, windowMs: 60000, methods: ['POST'] }));
app.post('/api/build/projects/:id/plan', async (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;

  let aborted = false;
  req.on('close', () => { aborted = true; });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  function sendEvent(data) {
    if (!aborted && !res.writableEnded) res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const config = getConfig();
    const model = req.body.model || config.defaultModel;
    const phaseNumber = req.body.phaseNumber;
    const researchContext = req.body.researchContext || '';
    if (!phaseNumber) {
      sendEvent({ error: 'phaseNumber is required' });
      return res.end();
    }

    const bridge = new GsdBridge(project.path);
    const state = bridge.getState();

    const stateStr = JSON.stringify(state).slice(0, 3000);

    const messages = [
      {
        role: 'system',
        content: 'You are a project planner. Given the research context and project state, create a concrete plan for phase ' + phaseNumber + '. Include: 1) Phase goal, 2) Tasks with specific file paths and actions, 3) Success criteria, 4) Estimated complexity. Format as markdown with clear headings.'
      },
      {
        role: 'user',
        content: `Project: ${project.name}\nPhase: ${phaseNumber}\n\nResearch context:\n${researchContext.slice(0, 4000)}\n\nState (truncated):\n${stateStr}`
      }
    ];

    const result = await chatComplete(config.ollamaUrl, model, messages, 180000);

    // Stream result progressively as words
    const words = result.split(/(\s+)/);
    for (const word of words) {
      if (aborted) break;
      sendEvent({ token: word });
    }

    // Write-after-validate
    const validated = result.length > 100 && result.trim().startsWith('#') && result.trim().length > 0;
    let written = false;

    if (validated && req.body.writeToFile) {
      try {
        const planningDir = path.join(project.path, '.planning', 'phases');
        const targetPath = path.join(planningDir, `phase-${phaseNumber}-ai-plan.md`);
        // Validate path is within project
        if (isWithinBasePath(targetPath, project.path)) {
          // Ensure directory exists
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          // Atomic write: temp file then rename
          const tmpPath = targetPath + `.tmp.${process.pid}`;
          fs.writeFileSync(tmpPath, result, 'utf-8');
          fs.renameSync(tmpPath, targetPath);
          written = true;
        } else {
          log('WARN', `Blocked write outside project: ${targetPath}`);
        }
      } catch (writeErr) {
        log('ERROR', `Failed to write plan: ${writeErr.message}`);
      }
    }

    if (!aborted) sendEvent({ done: true, validated, written });
  } catch (err) {
    log('ERROR', `build-plan failed: ${err.message}`);
    sendEvent({ error: err.message });
  }
  if (!res.writableEnded) res.end();
});


// ── Planning File Viewer API ─────────────────────────

const PLANNING_FILE_WHITELIST = [
  'ROADMAP.md', 'REQUIREMENTS.md', 'STATE.md', 'CONTEXT.md',
  'PROJECT.md', 'RETROSPECTIVE.md', 'config.json'
];

// GET /api/build/projects/:id/files — list available planning files
app.get('/api/build/projects/:id/files', (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  try {
    const planningDir = path.join(project.path, '.planning');
    if (!fs.existsSync(planningDir)) {
      return res.json({ files: [] });
    }
    const entries = fs.readdirSync(planningDir);
    const files = PLANNING_FILE_WHITELIST.filter(f => entries.includes(f));
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/build/projects/:id/files/:filename — read a planning file
app.get('/api/build/projects/:id/files/:filename', (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  const { filename } = req.params;
  if (!PLANNING_FILE_WHITELIST.includes(filename)) {
    return res.status(403).json({ error: 'File not in whitelist' });
  }
  const fullPath = path.join(project.path, '.planning', filename);
  const basePath = path.join(project.path, '.planning');
  if (!isWithinBasePath(basePath, fullPath)) {
    return res.status(403).json({ error: 'Path traversal blocked' });
  }
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ content, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/build/projects/:id/files/:filename — write a planning file (atomic)
app.put('/api/build/projects/:id/files/:filename', (req, res) => {
  const project = _resolveBuildProject(req, res);
  if (!project) return;
  const { filename } = req.params;
  if (!PLANNING_FILE_WHITELIST.includes(filename)) {
    return res.status(403).json({ error: 'File not in whitelist' });
  }
  const fullPath = path.join(project.path, '.planning', filename);
  const basePath = path.join(project.path, '.planning');
  if (!isWithinBasePath(basePath, fullPath)) {
    return res.status(403).json({ error: 'Path traversal blocked' });
  }
  const { content } = req.body || {};
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'content must be a non-empty string' });
  }
  try {
    const tmpPath = fullPath + '.tmp.' + process.pid;
    fs.writeFileSync(tmpPath, content, 'utf-8');
    fs.renameSync(tmpPath, fullPath);
    res.json({ success: true, filename });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GitHub Integration API ───────────────────────────

// POST /api/github/clone — clone a repo by URL
app.post('/api/github/clone', (req, res) => {
  const { url: repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Missing repo URL' });

  const config = getConfig();
  const token = config.githubToken || '';

  log('INFO', `Cloning GitHub repo: ${repoUrl}`);
  const result = cloneRepo(dataRoot, repoUrl, token);

  if (result.success) {
    log('INFO', `Clone success: ${result.owner}/${result.repo} → ${result.localPath}`);
    debug('Clone result', result);
  } else {
    log('ERROR', `Clone failed: ${result.error}`);
  }

  res.json(result);
});

// GET /api/github/repos — list cloned repos
app.get('/api/github/repos', (req, res) => {
  try {
    const repos = listClonedRepos(dataRoot);
    res.json({ repos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/github/repos/:dirName — delete a cloned repo
app.delete('/api/github/repos/:dirName', (req, res) => {
  const result = deleteClonedRepo(dataRoot, req.params.dirName);
  res.json(result);
});

// POST /api/github/open — set a cloned repo as the active project folder
app.post('/api/github/open', (req, res) => {
  const { dirName } = req.body;
  if (!dirName) return res.status(400).json({ error: 'Missing dirName' });
  if (!/^[a-zA-Z0-9_.-]+--[a-zA-Z0-9_.-]+$/.test(dirName)) {
    return res.status(400).json({ error: 'Invalid dirName' });
  }

  const reposRoot = path.resolve(dataRoot, 'github-repos');
  const fullPath = path.resolve(reposRoot, dirName);
  if (!isWithinBasePath(reposRoot, fullPath)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'Cloned repo not found' });

  const config = getConfig();
  config.projectFolder = fullPath;
  updateConfig(config);

  log('INFO', `Project folder set to cloned repo: ${fullPath}`);
  res.json({ success: true, projectFolder: fullPath });
});

// GET /api/github/browse — list user's GitHub repos (requires token)
app.get('/api/github/browse', async (req, res) => {
  const config = getConfig();
  const token = config.githubToken;
  if (!token) return res.status(401).json({ error: 'No GitHub token configured. Add one in Settings → GitHub.' });

  try {
    const page = parseInt(req.query.page) || 1;
    const repos = await listUserRepos(token, page);
    res.json({ repos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/github/token — validate and save GitHub token
app.post('/api/github/token', async (req, res) => {
  const { token } = req.body;

  if (!token) {
    // Clear token
    const config = getConfig();
    config.githubToken = '';
    updateConfig(config);
    return res.json({ valid: true, message: 'Token cleared' });
  }

  const result = await validateToken(token);
  if (result.valid) {
    const config = getConfig();
    config.githubToken = token;
    updateConfig(config);
    log('INFO', `GitHub token saved for user: ${result.username}`);
  }
  res.json(result);
});

// GET /api/github/token/status — check if a token is configured
app.get('/api/github/token/status', async (req, res) => {
  const config = getConfig();
  const token = config.githubToken;
  if (!token) return res.json({ configured: false });

  const result = await validateToken(token);
  res.json({ configured: true, ...result });
});

// POST /api/github/create — create a new GitHub repo
app.post('/api/github/create', async (req, res) => {
  const config = getConfig();
  const token = config.githubToken;
  if (!token) return res.status(401).json({ error: 'GitHub token not configured. Add one in Settings → GitHub.' });

  const { name, description, isPrivate } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Repository name is required' });

  try {
    const result = await createRepo(token, name, { description, isPrivate });
    if (result.success) {
      log('INFO', `GitHub repo created: ${result.fullName}`);
    } else {
      log('ERROR', `GitHub create failed: ${result.error}`);
    }
    res.status(result.success ? 201 : 400).json(result);
  } catch (err) {
    log('ERROR', `GitHub create error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/github/push — init local repo and push to remote
app.post('/api/github/push', (req, res) => {
  const config = getConfig();
  const token = config.githubToken;
  if (!token) return res.status(401).json({ error: 'GitHub token not configured' });

  const { localPath, remoteUrl, commitMessage, branch } = req.body || {};
  if (!localPath || !remoteUrl) return res.status(400).json({ error: 'localPath and remoteUrl are required' });
  if (!fs.existsSync(localPath)) return res.status(404).json({ error: 'Local path does not exist' });

  try {
    const result = initAndPush(localPath, remoteUrl, token, { commitMessage, branch });
    if (result.success) {
      log('INFO', `Pushed to GitHub: ${remoteUrl}`);
    } else {
      log('ERROR', `Push failed: ${result.error}`);
    }
    res.json(result);
  } catch (err) {
    log('ERROR', `Push error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/logs ────────────────────────────────────

app.get('/api/logs', (req, res) => {
  const type = req.query.type === 'debug' ? 'debug.log' : 'app.log';
  const lines = parseInt(req.query.lines) || 50;
  const logPath = path.join(logDir, type);
  try {
    if (!fs.existsSync(logPath)) return res.json({ lines: [], file: type });
    const content = fs.readFileSync(logPath, 'utf8');
    const allLines = content.split('\n').filter(Boolean);
    res.json({ lines: allLines.slice(-lines), file: type, total: allLines.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── MCP HTTP Server (Factory pattern) ─────────────────

// Factory: fresh McpServer per request (required for concurrency)
function createMcpServer() {
  const config = getConfig();
  const disabledTools = config.mcpServer?.disabledTools || [];
  const mcpServer = new McpServer({ name: 'code-companion-mcp', version: '1.0.0' });
  registerAllTools(mcpServer, {
    getConfig, log, debug,
    listModels, chatComplete, checkConnection,
    buildFileTree, readProjectFile, listConversations
  }, disabledTools);
  return mcpServer;
}

// Place AFTER all /api/* routes but BEFORE SPA fallback
app.all('/mcp', async (req, res) => {
  try {
    const config = getConfig();
    if (config.mcpServer?.httpEnabled === false) {
      return res.status(503).json({ error: 'MCP server is disabled' });
    }
    const mcpServer = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on('close', () => transport.close());
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    log('ERROR', 'MCP request failed', { error: err.message });
    if (!res.headersSent) {
      res.status(500).json({ error: 'MCP server error' });
    }
  }
});

// ── Graceful shutdown ────────────────────────────────
process.on('SIGINT', async () => {
  log('INFO', 'Shutting down — disconnecting MCP clients...');
  await mcpClientManager.disconnectAll();
  process.exit(0);
});

// ── SPA Fallback (must be after all API routes) ──────

app.get('*', (req, res) => {
  const indexPath = path.join(staticDir, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  res.status(404).send('Not found');
});

// ── Start ────────────────────────────────────────────

function getLocalNetworkUrl() {
  try {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === 'IPv4' && !net.internal) return `${useHttps ? 'https' : 'http'}://${net.address}:${PORT}`;
      }
    }
  } catch (_) {}
  return null;
}

const proto = useHttps ? 'https' : 'http';
const http = require('http');

let serverInstance;

if (useHttps) {
  serverInstance = https.createServer({ cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }, app);

  // Also start an HTTP server on PORT+1 that redirects to HTTPS on PORT.
  // Users with old http://localhost:PORT bookmarks can update to the new URL.
  const HTTP_REDIRECT_PORT = PORT + 1;
  http.createServer((req, res) => {
    const host = (req.headers.host || `localhost:${PORT}`).split(':')[0];
    res.writeHead(301, { Location: `https://${host}:${PORT}${req.url}` });
    res.end();
  }).listen(HTTP_REDIRECT_PORT, HOST, () => {
    log('INFO', `HTTP→HTTPS redirect on port ${HTTP_REDIRECT_PORT}`);
  });
} else {
  serverInstance = http.createServer(app);
}

const server = serverInstance.listen(PORT, HOST, () => {
  const config = getConfig();
  const localUrl = `${proto}://localhost:${PORT}`;
  const remoteUrl = HOST === '0.0.0.0' ? getLocalNetworkUrl() : null;
  log('INFO', `Th3rdAI Code Companion started on ${localUrl}${useHttps ? ' (HTTPS)' : ''}`);
  if (remoteUrl) log('INFO', `Remote access: ${remoteUrl}`);
  log('INFO', `Ollama endpoint: ${config.ollamaUrl}`);
  log('INFO', `History dir: ${path.join(dataRoot, 'history')}`);
  log('INFO', `Log dir: ${logDir}`);
  log('INFO', `MCP HTTP server: enabled at /mcp`);
  log('INFO', `Debug mode: ${DEBUG ? 'ON' : 'OFF (set DEBUG=1 to enable console debug output)'}`);
  console.log(`\n  Th3rdAI Code Companion running at ${localUrl}${useHttps ? ' (HTTPS — accept the self-signed cert warning in your browser)' : ''}`);
  if (remoteUrl) console.log(`  Remote access: ${remoteUrl}`);
  console.log(`  Ollama endpoint: ${config.ollamaUrl}`);
  console.log(`  MCP HTTP server: /mcp`);
  console.log(`  Logs: ${logDir}`);
  console.log(`  Tip: run with DEBUG=1 for verbose console output`);
  if (!useHttps) console.log(`  Tip: add cert/server.crt + cert/server.key to enable HTTPS`);
  if (useHttps)  console.log(`  SSL issues? Clear HSTS for localhost at chrome://net-internals/#hsts`);
  console.log();

  // Notify Electron parent process that server is ready
  if (process.send) {
    process.send({ type: 'server-ready', port: PORT });
  }

  // Auto-connect configured MCP clients
  const autoClients = (config.mcpClients || []).filter(c => c.autoConnect);
  if (autoClients.length > 0) {
    log('INFO', `Auto-connecting ${autoClients.length} MCP client(s)...`);
    for (const clientConfig of autoClients) {
      mcpClientManager.connect(clientConfig).then(tools => {
        log('INFO', `Auto-connected: ${clientConfig.name} (${tools.length} tools)`);
      }).catch(err => {
        log('ERROR', `Auto-connect failed for ${clientConfig.name}: ${err.message}`);
      });
    }
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use. Stop the process using it, or use a different port:\n`);
    console.error(`    PORT=3001 node server.js\n`);
    console.error(`  To stop whatever is on port ${PORT}:  lsof -ti:${PORT} | xargs kill\n`);
  } else {
    console.error('Server error:', err);
  }
  log('ERROR', `Server failed: ${err.message}`);
  process.exit(1);
});

// Export app for potential programmatic use
module.exports = app;
