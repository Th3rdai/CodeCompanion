const express = require('express');
const fs = require('fs');
const path = require('path');

// ── Lib imports ──────────────────────────────────────
const { createLogger } = require('./lib/logger');
const { initConfig, getConfig, updateConfig } = require('./lib/config');
const { initHistory, listConversations, getConversation, saveConversation, deleteConversation } = require('./lib/history');
const { ScaffolderError, scaffoldProject } = require('./lib/icm-scaffolder');
const { SYSTEM_PROMPTS } = require('./lib/prompts');
const { listModels, checkConnection, chatStream, chatComplete } = require('./lib/ollama-client');
const { buildFileTree, readProjectFile, isTextFile, TEXT_EXTENSIONS, IGNORE_DIRS } = require('./lib/file-browser');
const {
  cloneRepo,
  deleteClonedRepo,
  listClonedRepos,
  listUserRepos,
  validateToken,
  getGitStatus,
  createBranch,
  getGitDiff,
  getMergePreview,
  listConflictFiles,
  resolveConflictFile
} = require('./lib/github');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { registerAllTools } = require('./mcp/tools');
const McpClientManager = require('./lib/mcp-client-manager');
const ToolCallHandler = require('./lib/tool-call-handler');
const { createMcpApiRoutes } = require('./lib/mcp-api-routes');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';
const CPU_COUNT = require('os').cpus()?.length || 1;

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(data.errorMessages?.join(', ') || data.message || `Request failed (${res.status})`);
  }
  return data;
}

function flattenTree(treeNodes, into = []) {
  for (const node of treeNodes || []) {
    into.push(node);
    if (node.type === 'dir' && Array.isArray(node.children)) {
      flattenTree(node.children, into);
    }
  }
  return into;
}

function extractApiRoutesFromSource(sourceText) {
  const routeRegex = /app\.(get|post|put|patch|delete|all)\(\s*['"`]([^'"`]+)['"`]/g;
  const routes = [];
  let match;
  while ((match = routeRegex.exec(sourceText)) !== null) {
    routes.push({
      method: match[1].toUpperCase(),
      path: match[2]
    });
  }
  return routes;
}

// ── Initialize modules ───────────────────────────────
initConfig(__dirname);
initHistory(__dirname);
const { log, debug, logDir } = createLogger(__dirname, { debugEnabled: DEBUG });

// ── Initialize MCP Client Manager ────────────────────
const mcpClientManager = new McpClientManager({ log, debug });
const toolCallHandler = new ToolCallHandler(mcpClientManager, { log, debug });

// ── Mount MCP API routes ─────────────────────────────
const { router: mcpApiRouter, recordToolCall } = createMcpApiRoutes({
  getConfig, updateConfig, mcpClientManager, log, debug
});

app.use(express.json({ limit: '5mb' }));

// Serve Vite production build (dist/) if available, fallback to legacy public/
const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');
const staticDir = fs.existsSync(distDir) ? distDir : publicDir;
app.use(express.static(staticDir));

// ── Request logging middleware ───────────────────────

const performanceMetrics = {
  startedAt: Date.now(),
  requestsTotal: 0,
  requestTimestamps: [],
  latencySamplesMs: [],
  bytesInTotal: 0,
  bytesOutTotal: 0,
  trafficSamples: [],
  statusCounts: {},
  cpuSnapshot: {
    usage: process.cpuUsage(),
    timeNs: process.hrtime.bigint()
  },
  cpuPercent: 0
};

function computeCpuPercent() {
  const nowUsage = process.cpuUsage();
  const nowTimeNs = process.hrtime.bigint();
  const prevUsage = performanceMetrics.cpuSnapshot.usage;
  const prevTimeNs = performanceMetrics.cpuSnapshot.timeNs;

  const usageDiffUs = (nowUsage.user - prevUsage.user) + (nowUsage.system - prevUsage.system);
  const timeDiffUs = Number(nowTimeNs - prevTimeNs) / 1000;

  performanceMetrics.cpuSnapshot = { usage: nowUsage, timeNs: nowTimeNs };

  if (timeDiffUs <= 0) return performanceMetrics.cpuPercent;

  const normalized = (usageDiffUs / (timeDiffUs * CPU_COUNT)) * 100;
  performanceMetrics.cpuPercent = Math.max(0, Math.min(100, Number(normalized.toFixed(2))));
  return performanceMetrics.cpuPercent;
}

function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[Math.max(idx, 0)].toFixed(2));
}

app.use((req, res, next) => {
  const startedAt = Date.now();
  const reqBytes = Number(req.headers['content-length']) || 0;
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('INFO', `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);

    const now = Date.now();
    const resBytes = Number(res.getHeader('content-length')) || 0;

    performanceMetrics.requestsTotal += 1;
    performanceMetrics.bytesInTotal += reqBytes;
    performanceMetrics.bytesOutTotal += resBytes;
    performanceMetrics.requestTimestamps.push(now);
    performanceMetrics.latencySamplesMs.push(duration);
    performanceMetrics.trafficSamples.push({ ts: now, inBytes: reqBytes, outBytes: resBytes });
    performanceMetrics.statusCounts[res.statusCode] = (performanceMetrics.statusCounts[res.statusCode] || 0) + 1;

    const oneMinuteAgo = now - 60_000;
    performanceMetrics.requestTimestamps = performanceMetrics.requestTimestamps.filter(ts => ts >= oneMinuteAgo);
    performanceMetrics.trafficSamples = performanceMetrics.trafficSamples.filter(sample => sample.ts >= oneMinuteAgo);
    if (performanceMetrics.latencySamplesMs.length > 400) {
      performanceMetrics.latencySamplesMs = performanceMetrics.latencySamplesMs.slice(-400);
    }

    const processingMs = now - startedAt;
    debug('Request metrics updated', { path: req.path, processingMs, reqBytes, resBytes });
  });
  next();
});

// ── MCP Management API routes ────────────────────────
app.use('/api', mcpApiRouter);

// ── GET /api/config ──────────────────────────────────

app.get('/api/config', (req, res) => {
  debug('Config requested');
  res.json(getConfig());
});

// ── POST /api/config ─────────────────────────────────

app.post('/api/config', (req, res) => {
  const { ollamaUrl, projectFolder } = req.body;
  const config = getConfig();

  if (ollamaUrl) {
    config.ollamaUrl = ollamaUrl.replace(/\/+$/, '');
    log('INFO', `Ollama URL changed to: ${config.ollamaUrl}`);
  }
  if (projectFolder !== undefined) {
    if (projectFolder && !fs.existsSync(projectFolder)) {
      return res.status(400).json({ error: 'Folder does not exist' });
    }
    config.projectFolder = projectFolder || '';
    log('INFO', `Project folder set to: ${config.projectFolder || '(none)'}`);
  }

  updateConfig(config);
  res.json(getConfig());
});

// ── POST /api/create-project ──────────────────────────

app.post('/api/create-project', (req, res) => {
  const { name, description, role, audience, tone, stages, outputRoot, overwrite } = req.body;

  try {
    const result = scaffoldProject({
      config: getConfig(),
      name,
      description,
      role,
      audience,
      tone,
      stages,
      outputRoot,
      overwrite
    });

    log('INFO', `Create mode scaffolded project: ${result.projectPath}`);
    res.status(201).json(result);
  } catch (err) {
    const status = err instanceof ScaffolderError ? err.status : 500;
    const code = err instanceof ScaffolderError ? err.code : 'CREATE_FAILED';
    log('ERROR', 'Create mode scaffolding failed', { code, error: err.message });
    res.status(status).json({ success: false, code, error: err.message });
  }
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

  // Append external tool descriptions if any MCP clients are connected
  const toolsPrompt = toolCallHandler.buildToolsPrompt();
  const enrichedSystemPrompt = systemPrompt + toolsPrompt;
  const hasExternalTools = toolsPrompt.length > 0;

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
            const content = result.result?.content?.map(c => c.text).join('\n') || JSON.stringify(result.result);
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
    res.status(404).json({ error: 'Not found' });
  }
});

app.post('/api/history', (req, res) => {
  try {
    const id = saveConversation(req.body);
    debug('Conversation saved', { id });
    res.json({ id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/history/:id', (req, res) => {
  try {
    deleteConversation(req.params.id);
    debug('Conversation deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── File Browser API ─────────────────────────────────

// GET /api/files/tree — list directory structure
app.get('/api/files/tree', (req, res) => {
  const config = getConfig();
  const folder = req.query.path || config.projectFolder;
  if (!folder) return res.status(400).json({ error: 'No project folder configured' });
  if (!fs.existsSync(folder)) return res.status(404).json({ error: 'Folder not found' });

  const maxDepth = parseInt(req.query.depth) || 3;

  try {
    debug('Building file tree', { folder, maxDepth });
    const result = buildFileTree(folder, maxDepth);
    res.json(result);
  } catch (err) {
    log('ERROR', 'Failed to build file tree', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/read — read file contents
app.get('/api/files/read', (req, res) => {
  const config = getConfig();
  const filePath = req.query.path;
  const folder = config.projectFolder;

  if (!filePath || !folder) return res.status(400).json({ error: 'Missing path or project folder' });

  try {
    const result = readProjectFile(folder, filePath);
    debug('File read', { path: filePath, size: result.size });
    res.json(result);
  } catch (err) {
    if (err.message.includes('Path traversal')) {
      log('ERROR', 'Path traversal attempt blocked', { filePath, folder });
      return res.status(403).json({ error: 'Access denied' });
    }
    log('ERROR', 'Failed to read file', { path: filePath, error: err.message });
    res.status(500).json({ error: `Cannot read file: ${err.message}` });
  }
});

// POST /api/files/upload — receive uploaded file content (sent as text from browser)
app.post('/api/files/upload', (req, res) => {
  const { name, content } = req.body;
  if (!name || content === undefined) return res.status(400).json({ error: 'Missing name or content' });
  debug('File uploaded via chat', { name, size: content.length });
  res.json({ name, size: content.length, content });
});

// ── GitHub Integration API ───────────────────────────

// POST /api/github/clone — clone a repo by URL
app.post('/api/github/clone', (req, res) => {
  const { url: repoUrl } = req.body;
  if (!repoUrl) return res.status(400).json({ error: 'Missing repo URL' });

  const config = getConfig();
  const token = config.githubToken || '';

  log('INFO', `Cloning GitHub repo: ${repoUrl}`);
  const result = cloneRepo(__dirname, repoUrl, token);

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
    const repos = listClonedRepos(__dirname);
    res.json({ repos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/github/repos/:dirName — delete a cloned repo
app.delete('/api/github/repos/:dirName', (req, res) => {
  const result = deleteClonedRepo(__dirname, req.params.dirName);
  res.json(result);
});

// POST /api/github/open — set a cloned repo as the active project folder
app.post('/api/github/open', (req, res) => {
  const { dirName } = req.body;
  if (!dirName) return res.status(400).json({ error: 'Missing dirName' });

  const fullPath = path.join(__dirname, 'github-repos', dirName);
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

// ── Git (Local VCS) API ──────────────────────────────

function getActiveRepoPath() {
  const config = getConfig();
  return config.projectFolder;
}

app.get('/api/git/status', (req, res) => {
  try {
    const repoPath = getActiveRepoPath();
    const status = getGitStatus(repoPath);
    const conflicts = listConflictFiles(repoPath);
    res.json({ repoPath, ...status, conflicts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/git/branch', (req, res) => {
  try {
    const repoPath = getActiveRepoPath();
    const { name, checkout } = req.body;
    const result = createBranch(repoPath, name, checkout !== false);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/git/diff', (req, res) => {
  try {
    const repoPath = getActiveRepoPath();
    const filePath = req.query.file || '';
    const result = getGitDiff(repoPath, filePath);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/git/merge-preview', (req, res) => {
  try {
    const repoPath = getActiveRepoPath();
    const { sourceBranch, targetRef } = req.body;
    const result = getMergePreview(repoPath, sourceBranch, targetRef || 'HEAD');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/git/resolve', (req, res) => {
  try {
    const repoPath = getActiveRepoPath();
    const { filePath, strategy } = req.body;
    const result = resolveConflictFile(repoPath, filePath, strategy);
    const conflicts = listConflictFiles(repoPath);
    res.json({ ...result, remainingConflicts: conflicts });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/git/review', async (req, res) => {
  try {
    const repoPath = getActiveRepoPath();
    const { filePath = '', model } = req.body;
    if (!model) {
      return res.status(400).json({ error: 'model is required' });
    }

    const diffResult = getGitDiff(repoPath, filePath);
    const diffText = diffResult.diff || '';
    if (!diffText.trim()) {
      return res.json({
        review: 'No diff to review. Make changes first, then run automated review.'
      });
    }

    const reviewPrompt = `${SYSTEM_PROMPTS.bugs}

You are reviewing a git diff for a PM and engineering audience.
Focus on: correctness, regressions, security, maintainability, and test gaps.
Respond with concise markdown sections:
- Findings (ordered by severity)
- Suggested fixes
- Validation checklist

Git diff:
\`\`\`diff
${diffText}
\`\`\`
`;

    const config = getConfig();
    const review = await chatComplete(config.ollamaUrl, model, [
      { role: 'system', content: 'You are a senior code reviewer.' },
      { role: 'user', content: reviewPrompt }
    ]);

    res.json({ review });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── PM Integrations API (Jira/Trello/Asana) ─────────

app.post('/api/pm/jira/issues', async (req, res) => {
  try {
    const { baseUrl, email, apiToken, jql } = req.body;
    if (!baseUrl || !email || !apiToken) {
      return res.status(400).json({ error: 'baseUrl, email, and apiToken are required' });
    }

    const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
    const query = encodeURIComponent(jql || 'ORDER BY updated DESC');
    const url = `${String(baseUrl).replace(/\/+$/, '')}/rest/api/3/search?jql=${query}&maxResults=20`;
    const data = await fetchJson(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${auth}`
      }
    });

    const issues = (data.issues || []).map(issue => ({
      id: issue.id,
      key: issue.key,
      title: issue.fields?.summary || issue.key,
      status: issue.fields?.status?.name || 'Unknown',
      type: issue.fields?.issuetype?.name || 'Issue',
      url: `${String(baseUrl).replace(/\/+$/, '')}/browse/${issue.key}`
    }));
    res.json({ provider: 'jira', items: issues });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/pm/trello/cards', async (req, res) => {
  try {
    const { boardId, key, token } = req.body;
    if (!boardId || !key || !token) {
      return res.status(400).json({ error: 'boardId, key, and token are required' });
    }

    const url = `https://api.trello.com/1/boards/${encodeURIComponent(boardId)}/cards?key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}&fields=name,url,idList,due,closed&limit=50`;
    const cards = await fetchJson(url);
    const items = (cards || []).map(card => ({
      id: card.id,
      key: card.id.slice(0, 8),
      title: card.name,
      status: card.closed ? 'closed' : 'open',
      type: 'Card',
      url: card.url
    }));
    res.json({ provider: 'trello', items });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/pm/asana/tasks', async (req, res) => {
  try {
    const { projectId, accessToken } = req.body;
    if (!projectId || !accessToken) {
      return res.status(400).json({ error: 'projectId and accessToken are required' });
    }

    const url = `https://app.asana.com/api/1.0/projects/${encodeURIComponent(projectId)}/tasks?opt_fields=name,permalink_url,completed,memberships.section.name&limit=50`;
    const data = await fetchJson(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`
      }
    });

    const items = (data.data || []).map(task => ({
      id: task.gid,
      key: task.gid,
      title: task.name,
      status: task.completed ? 'completed' : 'open',
      type: task.memberships?.[0]?.section?.name || 'Task',
      url: task.permalink_url
    }));
    res.json({ provider: 'asana', items });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Generated Docs API ───────────────────────────────

app.post('/api/docs/generate', async (req, res) => {
  try {
    const { model, includeAiSummary = false } = req.body || {};
    const config = getConfig();
    const projectRoot = config.projectFolder || __dirname;

    const treeData = buildFileTree(projectRoot, 4);
    const flatNodes = flattenTree(treeData.tree || []);
    const fileNodes = flatNodes.filter(node => node.type === 'file');
    const dirNodes = flatNodes.filter(node => node.type === 'dir');

    const serverSource = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    const apiRoutes = extractApiRoutesFromSource(serverSource)
      .filter(route => route.path.startsWith('/api') || route.path === '/mcp');

    let markdown = `# Generated Code Companion Docs

Generated: ${new Date().toLocaleString()}
Project root: \`${projectRoot}\`

## Codebase Snapshot
- Directories indexed: ${dirNodes.length}
- Text files indexed: ${fileNodes.length}

## API Endpoints
| Method | Path |
|---|---|
${apiRoutes.map(route => `| ${route.method} | \`${route.path}\` |`).join('\n') || '| N/A | N/A |'}

## Top-Level Files
${fileNodes
  .filter(node => !String(node.path || '').includes('/'))
  .slice(0, 60)
  .map(node => `- \`${node.path}\` (${node.ext || 'file'})`)
  .join('\n') || '- No files found'}

## Suggested Next Checks
- Validate API auth and error handling consistency.
- Confirm tests cover newly added endpoints.
- Review bundle size warnings from production build.
`;

    if (includeAiSummary) {
      if (!model) {
        return res.status(400).json({ error: 'model is required when includeAiSummary=true' });
      }
      const prompt = `Create a PM-friendly documentation summary from this markdown. Include: architecture overview, API highlights, and risk checklist.\n\n${markdown}`;
      const aiSummary = await chatComplete(config.ollamaUrl, model, [
        { role: 'system', content: SYSTEM_PROMPTS['translate-tech'] },
        { role: 'user', content: prompt }
      ]);
      markdown += `\n## AI Summary\n${aiSummary}\n`;
    }

    res.json({
      generatedAt: new Date().toISOString(),
      root: projectRoot,
      fileCount: fileNodes.length,
      dirCount: dirNodes.length,
      routeCount: apiRoutes.length,
      markdown
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── Code Analysis + Debug API ────────────────────────

app.post('/api/code/analyze', async (req, res) => {
  try {
    const { model, filePath, focus = 'bugs' } = req.body || {};
    if (!model) return res.status(400).json({ error: 'model is required' });

    const repoPath = getActiveRepoPath();
    if (!repoPath) return res.status(400).json({ error: 'No active project folder configured' });

    let content = '';
    if (filePath) {
      const result = readProjectFile(repoPath, filePath);
      content = result.content || '';
    } else {
      const diff = getGitDiff(repoPath, '').diff || '';
      content = diff ? `Git diff:\n\`\`\`diff\n${diff}\n\`\`\`` : '';
    }

    if (!content.trim()) {
      return res.json({ analysis: 'No content available to analyze.' });
    }

    const mode = focus === 'explain' ? 'explain' : focus === 'refactor' ? 'refactor' : 'bugs';
    const prompt = `Analyze the following code context and provide practical PM + engineering insights.\n\n${content}`;
    const analysis = await chatComplete(getConfig().ollamaUrl, model, [
      { role: 'system', content: SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.bugs },
      { role: 'user', content: prompt }
    ]);
    res.json({ analysis });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/code/debug', async (req, res) => {
  try {
    const { model, errorMessage, stackTrace = '', filePath = '' } = req.body || {};
    if (!model) return res.status(400).json({ error: 'model is required' });
    if (!errorMessage) return res.status(400).json({ error: 'errorMessage is required' });

    const repoPath = getActiveRepoPath();
    let fileContext = '';
    if (repoPath && filePath) {
      try {
        const result = readProjectFile(repoPath, filePath);
        fileContext = result.content || '';
      } catch {}
    }

    const debugPrompt = `You are performing one-click debugging for a PM/dev team.
Error message:
${errorMessage}

Stack trace:
${stackTrace || '(none provided)'}

Related file: ${filePath || '(not provided)'}
${fileContext ? `\nCode context:\n\`\`\`\n${fileContext}\n\`\`\`` : ''}

Provide:
1) Most likely root cause
2) Quick fix
3) Safer long-term fix
4) Validation steps`;

    const debugResult = await chatComplete(getConfig().ollamaUrl, model, [
      { role: 'system', content: SYSTEM_PROMPTS.bugs },
      { role: 'user', content: debugPrompt }
    ]);

    res.json({ debug: debugResult });
  } catch (err) {
    res.status(400).json({ error: err.message });
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

// ── GET /api/performance ─────────────────────────────

app.get('/api/performance', (req, res) => {
  const now = Date.now();
  const minuteTraffic = performanceMetrics.trafficSamples.filter(sample => sample.ts >= now - 60_000);
  const minuteIn = minuteTraffic.reduce((sum, sample) => sum + sample.inBytes, 0);
  const minuteOut = minuteTraffic.reduce((sum, sample) => sum + sample.outBytes, 0);
  const avgLatency = performanceMetrics.latencySamplesMs.length
    ? performanceMetrics.latencySamplesMs.reduce((sum, value) => sum + value, 0) / performanceMetrics.latencySamplesMs.length
    : 0;

  const mem = process.memoryUsage();
  const payload = {
    timestamp: new Date().toISOString(),
    uptimeSec: Math.floor((now - performanceMetrics.startedAt) / 1000),
    cpu: {
      usagePercent: computeCpuPercent()
    },
    memory: {
      rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
      heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
      externalMb: Number((mem.external / 1024 / 1024).toFixed(2)),
      arrayBuffersMb: Number((mem.arrayBuffers / 1024 / 1024).toFixed(2))
    },
    network: {
      bytesInTotal: performanceMetrics.bytesInTotal,
      bytesOutTotal: performanceMetrics.bytesOutTotal,
      inboundKbps1m: Number(((minuteIn * 8) / 60 / 1000).toFixed(2)),
      outboundKbps1m: Number(((minuteOut * 8) / 60 / 1000).toFixed(2))
    },
    requests: {
      total: performanceMetrics.requestsTotal,
      perMinute: performanceMetrics.requestTimestamps.length,
      avgLatencyMs: Number(avgLatency.toFixed(2)),
      p95LatencyMs: percentile(performanceMetrics.latencySamplesMs, 95),
      statusCounts: performanceMetrics.statusCounts
    }
  };

  res.json(payload);
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

app.listen(PORT, () => {
  const config = getConfig();
  log('INFO', `Th3rdAI Code Companion started on http://localhost:${PORT}`);
  log('INFO', `Ollama endpoint: ${config.ollamaUrl}`);
  log('INFO', `History dir: ${path.join(__dirname, 'history')}`);
  log('INFO', `Log dir: ${logDir}`);
  log('INFO', `MCP HTTP server: enabled at /mcp`);
  log('INFO', `Debug mode: ${DEBUG ? 'ON' : 'OFF (set DEBUG=1 to enable console debug output)'}`);
  console.log(`\n  Th3rdAI Code Companion running at http://localhost:${PORT}`);
  console.log(`  Ollama endpoint: ${config.ollamaUrl}`);
  console.log(`  MCP HTTP server: /mcp`);
  console.log(`  Logs: ${logDir}`);
  console.log(`  Tip: run with DEBUG=1 for verbose console output\n`);

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
