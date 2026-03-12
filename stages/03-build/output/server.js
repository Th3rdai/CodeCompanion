const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://192.168.50.7:11424';
const HISTORY_DIR = path.join(__dirname, 'history');

// Ensure history directory exists
if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true });

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── System Prompts per Mode ─────────────────────────

const SYSTEM_PROMPTS = {
  explain: `You are explaining code to a Product Manager who leads a development team.
Use clear, accessible language. Structure your response as:

## What This Code Does
(Plain-English summary — what would you tell a non-technical stakeholder?)

## How It Works
(Step-by-step walkthrough, using analogies where helpful)

## Business Impact
(What does this mean for the product? Any risks, dependencies, or implications?)

Keep it concise but thorough. Use bullet points for clarity.`,

  bugs: `You are a senior code reviewer helping a PM understand technical risks.
For each issue you find, format it as:

### 🔴/🟡/🟢 [Severity: Critical/High/Medium/Low] — Issue Title

**What's wrong:** Brief technical explanation
**User impact:** What could go wrong for end users?
**Suggested fix:** One-liner on how to address it

Start with the most critical issues. If the code looks solid, say so — don't invent problems.`,

  refactor: `You are a senior developer improving code quality.
First show the refactored code in a code block.
Then explain each change:

## Changes Made
1. **Change name** — Why this improves things (in plain English)
2. ...

Focus on: readability, performance, maintainability, and modern best practices.
Keep the same functionality — don't add features unless asked.`,

  'translate-tech': `You are translating technical content into business language for stakeholders.
Take the technical spec, PR description, or code and produce:

## Business Summary
(What is this feature/change in plain English?)

## User Impact
(How does this affect the product experience?)

## Timeline & Risk
(Any dependencies, risks, or concerns a PM should know?)

## Talking Points
(2-3 bullet points for communicating this to leadership)`,

  'translate-biz': `You are translating a business/product requirement into technical specs.
Take the feature request and produce:

## Technical Requirements
(What needs to be built, in developer terms)

## Suggested Architecture
(High-level approach — components, APIs, data flow)

## Acceptance Criteria
(Testable conditions that confirm the feature works)

## Estimated Complexity
(T-shirt size: S/M/L/XL with brief justification)

## Questions for PM
(What's unclear or needs product decision?)`
};

// ── GET /api/models ─────────────────────────────────

app.get('/api/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await response.json();
    const models = (data.models || []).map(m => ({
      name: m.name,
      size: Math.round(m.size / 1024 / 1024 / 1024 * 10) / 10,
      modified: m.modified_at
    }));
    res.json({ models, ollamaUrl: OLLAMA_URL });
  } catch (err) {
    res.status(503).json({ error: 'Cannot reach Ollama', detail: err.message, ollamaUrl: OLLAMA_URL });
  }
});

// ── POST /api/chat (SSE streaming) ──────────────────

app.post('/api/chat', async (req, res) => {
  const { model, messages, mode } = req.body;

  if (!model || !messages || !mode) {
    return res.status(400).json({ error: 'Missing model, messages, or mode' });
  }

  const systemPrompt = SYSTEM_PROMPTS[mode];
  if (!systemPrompt) {
    return res.status(400).json({ error: `Unknown mode: ${mode}` });
  }

  // Build message array with system prompt
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ];

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: true
      })
    });

    if (!ollamaRes.ok) {
      const errText = await ollamaRes.text();
      res.write(`data: ${JSON.stringify({ error: `Ollama error: ${ollamaRes.status} ${errText}` })}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    const reader = ollamaRes.body;
    let buffer = '';

    reader.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.message && parsed.message.content) {
            res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
          }
          if (parsed.done) {
            res.write(`data: ${JSON.stringify({
              done: true,
              total_duration: parsed.total_duration,
              eval_count: parsed.eval_count
            })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          }
        } catch (e) {
          // Skip unparseable lines
        }
      }
    });

    reader.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    });

    reader.on('end', () => {
      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer);
          if (parsed.message && parsed.message.content) {
            res.write(`data: ${JSON.stringify({ token: parsed.message.content })}\n\n`);
          }
          if (parsed.done) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
          }
        } catch (e) {}
      }
      if (!res.writableEnded) {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      reader.destroy();
    });

  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: `Connection failed: ${err.message}` })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// ── Conversation History ────────────────────────────

app.get('/api/history', (req, res) => {
  try {
    const files = fs.readdirSync(HISTORY_DIR).filter(f => f.endsWith('.json'));
    const conversations = files.map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(HISTORY_DIR, f), 'utf8'));
      return { id: data.id, title: data.title, mode: data.mode, model: data.model, createdAt: data.createdAt };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(conversations);
  } catch (err) {
    res.json([]);
  }
});

app.get('/api/history/:id', (req, res) => {
  const filePath = path.join(HISTORY_DIR, `${req.params.id}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
  res.json(JSON.parse(fs.readFileSync(filePath, 'utf8')));
});

app.post('/api/history', (req, res) => {
  const conv = req.body;
  if (!conv.id) conv.id = uuidv4();
  fs.writeFileSync(path.join(HISTORY_DIR, `${conv.id}.json`), JSON.stringify(conv, null, 2));
  res.json({ id: conv.id });
});

app.delete('/api/history/:id', (req, res) => {
  const filePath = path.join(HISTORY_DIR, `${req.params.id}.json`);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ ok: true });
});

// ── Start ───────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  🤖 Code Companion running at http://localhost:${PORT}`);
  console.log(`  📡 Ollama endpoint: ${OLLAMA_URL}`);
  console.log(`  📁 History stored in: ${HISTORY_DIR}\n`);
});
