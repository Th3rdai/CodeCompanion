const express = require('express');
const fs = require('fs');
const path = require('path');

// ── Lib imports ──────────────────────────────────────
const { createLogger } = require('./lib/logger');
const { initConfig, getConfig, updateConfig } = require('./lib/config');
const { initHistory, listConversations, getConversation, saveConversation, deleteConversation } = require('./lib/history');
const { SYSTEM_PROMPTS } = require('./lib/prompts');
const { listModels, checkConnection, chatStream, chatComplete } = require('./lib/ollama-client');
const { buildFileTree, readProjectFile, isTextFile, TEXT_EXTENSIONS, IGNORE_DIRS } = require('./lib/file-browser');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { registerAllTools } = require('./mcp/tools');
const McpClientManager = require('./lib/mcp-client-manager');
const ToolCallHandler = require('./lib/tool-call-handler');
const { createMcpApiRoutes } = require('./lib/mcp-api-routes');

const app = express();
const PORT = process.env.PORT || 3000;
const DEBUG = process.env.DEBUG === '1' || process.env.DEBUG === 'true';

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

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    log('INFO', `${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
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
