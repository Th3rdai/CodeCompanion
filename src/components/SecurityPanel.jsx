import { useState, useRef, useCallback, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { FileText, Upload as UploadIcon, FolderOpen, AlertTriangle, History } from 'lucide-react';
import SecurityReport from './SecurityReport';
import MessageBubble from './MessageBubble';
import MarkdownContent from './MarkdownContent';
import LoadingAnimation from './LoadingAnimation';

// ── Model tier system (same as ReviewPanel) ──────────
const MODEL_TIERS = {
  strong: [
    'qwen3:32b', 'qwen3:30b', 'qwen2.5:32b',
    'llama3:70b', 'llama3.1:70b', 'llama3.3:70b',
    'deepseek-r1:32b', 'deepseek-r1:70b',
    'codellama:34b', 'codellama:70b',
    'mixtral:8x22b', 'command-r-plus',
    'qwq:32b', 'gemma3:27b'
  ],
  adequate: [
    'qwen3:14b', 'qwen3:8b', 'qwen2.5:14b', 'qwen2.5:7b',
    'llama3:8b', 'llama3.1:8b', 'llama3.2:8b',
    'deepseek-r1:14b', 'deepseek-r1:8b',
    'codellama:13b', 'codellama:7b',
    'gemma3:12b', 'mistral:7b', 'mixtral:8x7b',
    'phi4:14b'
  ],
  weak: [
    'qwen3:4b', 'qwen3:1.7b', 'qwen3:0.6b',
    'qwen2.5:3b', 'qwen2.5:1.5b', 'qwen2.5:0.5b',
    'llama3.2:3b', 'llama3.2:1b',
    'deepseek-r1:1.5b', 'deepseek-r1:7b',
    'gemma3:4b', 'gemma3:1b',
    'phi4-mini:3.8b', 'tinyllama:1.1b'
  ]
};

function getModelTier(modelName) {
  if (!modelName) return 'unknown';
  const normalized = modelName.toLowerCase().replace(/:latest$/, '');
  for (const [tier, models] of Object.entries(MODEL_TIERS)) {
    if (models.some(m => normalized === m || normalized.startsWith(m + '-') || normalized.startsWith(m + ':'))) {
      return tier;
    }
  }
  const baseMatch = normalized.match(/^([^:]+):(\d+(?:\.\d+)?b)/);
  if (baseMatch) {
    const base = `${baseMatch[1]}:${baseMatch[2]}`;
    for (const [tier, models] of Object.entries(MODEL_TIERS)) {
      if (models.includes(base)) return tier;
    }
  }
  if (/(?:^|[^0-9])(?:0\.5b|1b|1\.5b|2b|3b|4b)(?:$|[^0-9])/.test(normalized)) return 'weak';
  if (/(?:^|[^0-9])(?:7b|8b)(?:$|[^0-9])/.test(normalized)) return 'adequate';
  return 'unknown';
}

function suggestBetterModel(currentModel, installedModels) {
  const currentTier = getModelTier(currentModel);
  if (currentTier === 'strong' || currentTier === 'unknown') return null;
  for (const targetTier of ['strong', 'adequate']) {
    if (targetTier === currentTier) continue;
    for (const model of installedModels) {
      if (getModelTier(model.name) === targetTier) {
        return { name: model.name, tier: targetTier };
      }
    }
  }
  return null;
}

// ── Security Panel ──────────────────────────────────
export default function SecurityPanel({
  selectedModel,
  connected,
  streaming: appStreaming,
  onAttachFromBrowser,
  onOpenFileBrowser,
  onToast,
  savedPentest,
  onSavePentest,
  models,
  onSetSelectedModel,
  onUpdatePentestDeepDive,
}) {
  // ── State ───────────────────────────────────────────
  const [phase, setPhase] = useState('input'); // 'input' | 'loading' | 'report' | 'fallback' | 'deep-dive'
  const [code, setCode] = useState('');
  const [filename, setFilename] = useState('');
  const [reportData, setReportData] = useState(null);
  const [fallbackContent, setFallbackContent] = useState('');
  const [deepDiveMessages, setDeepDiveMessages] = useState([]);
  const [deepDiveInput, setDeepDiveInput] = useState('');
  const [deepDiveStreaming, setDeepDiveStreaming] = useState(false);
  const [scanError, setScanError] = useState('');
  const [dragging, setDragging] = useState(false);

  const modelTier = getModelTier(selectedModel);
  const suggestedModel = suggestBetterModel(selectedModel, models || []);
  const showModelWarning = modelTier === 'weak' || modelTier === 'adequate';

  // ── Restore saved pentest from history ───────────────
  useEffect(() => {
    if (savedPentest) {
      if (savedPentest.reportData) {
        setReportData(savedPentest.reportData);
        setFilename(savedPentest.filename || '');
        setCode(savedPentest.code || '');
        setPhase('report');
        if (savedPentest.deepDiveMessages?.length > 0) {
          setDeepDiveMessages(savedPentest.deepDiveMessages);
        }
      } else if (savedPentest.fallbackContent) {
        setFallbackContent(savedPentest.fallbackContent);
        setFilename(savedPentest.filename || '');
        setCode(savedPentest.code || '');
        setPhase('fallback');
      }
    }
  }, [savedPentest]);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const deepDiveInputRef = useRef(null);
  const dragCounter = useRef(0);
  const deepDiveEndRef = useRef(null);

  const isLoading = phase === 'loading';

  // ── Submit security scan ─────────────────────────────
  const handleSubmitScan = useCallback(async () => {
    if (!code.trim() || !selectedModel || isLoading) return;

    setPhase('loading');
    setScanError('');
    setReportData(null);
    setFallbackContent('');

    try {
      const res = await fetch('/api/pentest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          code: code.trim(),
          filename: filename || undefined,
        }),
      });

      const contentType = res.headers.get('Content-Type') || '';

      if (contentType.includes('application/json')) {
        const result = await res.json();
        if (result.type === 'security-report' && result.data) {
          setReportData(result.data);
          setPhase('report');
          onSavePentest?.({
            reportData: result.data,
            filename: filename || undefined,
            code: code.trim(),
            model: selectedModel,
          });
          return;
        }
        setScanError(result.error || 'Unexpected response from security endpoint.');
        setPhase('input');
        return;
      }

      if (contentType.includes('text/event-stream')) {
        setPhase('fallback');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') break;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.token) {
                accumulated += parsed.token;
                setFallbackContent(accumulated);
              }
              if (parsed.error) {
                accumulated += `\n\nError: ${parsed.error}`;
                setFallbackContent(accumulated);
              }
            } catch {}
          }
        }
        setFallbackContent(accumulated);
        onSavePentest?.({
          fallbackContent: accumulated,
          filename: filename || undefined,
          code: code.trim(),
          model: selectedModel,
        });
        return;
      }

      const text = await res.text();
      setScanError(`Unexpected response: ${text.slice(0, 200)}`);
      setPhase('input');
    } catch (err) {
      setScanError(`Connection failed: ${err.message}`);
      setPhase('input');
    }
  }, [code, filename, selectedModel, isLoading]);

  // ── Deep dive into a category ──────────────────────
  const handleDeepDive = useCallback((categoryKey, categoryData) => {
    const context = `I just ran a security scan on some code and found issues in the ${categoryKey} category.\n\n**Category:** ${categoryData.label || categoryKey}\n**Grade:** ${categoryData.grade}\n**Summary:** ${categoryData.summary}\n\nHere is the original code:\n\`\`\`\n${code.trim()}\n\`\`\``;

    const systemMsg = {
      role: 'system',
      content: 'You are a senior security engineer helping a developer understand OWASP security findings in depth. Explain clearly, use analogies when helpful, and suggest specific fixes with code examples. Never use jargon without explanation.',
    };

    const vulnList = (categoryData.vulnerabilities || []).map(v =>
      `- **${v.title}** (${v.severity}): ${v.description}`
    ).join('\n');

    const userMsg = {
      role: 'user',
      content: `I want to understand the security issues in the "${categoryData.label || categoryKey}" category better.\n\nFindings:\n${vulnList || 'No specific findings, but the grade is ' + categoryData.grade}\n\nCan you explain what these issues mean, how an attacker could exploit them, and show me exactly how to fix them?`,
    };

    setDeepDiveMessages([
      { role: 'context', content: context },
      systemMsg,
      userMsg,
    ]);
    setDeepDiveInput('');
    setPhase('deep-dive');

    sendDeepDiveMessage([systemMsg, userMsg], context);
  }, [code, selectedModel]);

  // ── Send deep-dive chat message ───────────────────
  async function sendDeepDiveMessage(messages, contextStr) {
    if (!selectedModel) return;
    setDeepDiveStreaming(true);

    const chatMessages = messages
      .filter(m => m.role !== 'context')
      .map(m => ({ role: m.role === 'system' ? 'system' : m.role, content: m.content }));

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          mode: 'chat',
          messages: chatMessages,
        }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const parsed = JSON.parse(payload);
            if (parsed.token) {
              assistantContent += parsed.token;
              setDeepDiveMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'assistant') {
                  updated[lastIdx] = { role: 'assistant', content: assistantContent };
                } else {
                  updated.push({ role: 'assistant', content: assistantContent });
                }
                return updated;
              });
            }
            if (parsed.error) {
              assistantContent += `\n\nError: ${parsed.error}`;
            }
          } catch {}
        }
      }

      setDeepDiveMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = { role: 'assistant', content: assistantContent };
        } else {
          updated.push({ role: 'assistant', content: assistantContent });
        }
        return updated;
      });
    } catch (err) {
      setDeepDiveMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Connection failed: ${err.message}` },
      ]);
    } finally {
      setDeepDiveStreaming(false);
      setTimeout(() => deepDiveEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      setDeepDiveMessages(prev => {
        onUpdatePentestDeepDive?.(prev);
        return prev;
      });
    }
  }

  // ── Deep-dive follow-up ───────────────────────────
  async function handleDeepDiveFollowUp() {
    if (!deepDiveInput.trim() || deepDiveStreaming) return;

    const userMsg = { role: 'user', content: deepDiveInput.trim() };
    const updatedMessages = [...deepDiveMessages, userMsg];
    setDeepDiveMessages(updatedMessages);
    setDeepDiveInput('');

    await sendDeepDiveMessage(
      updatedMessages.filter(m => m.role !== 'context'),
      null
    );
  }

  // ── File handling ─────────────────────────────────
  function handleFileUpload(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCode(ev.target.result);
      setFilename(file.name);
      onToast?.(`Loaded: ${file.name}`);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Drag and drop ─────────────────────────────────
  function handleDragEnter(e) { e.preventDefault(); dragCounter.current++; setDragging(true); }
  function handleDragLeave(e) { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setDragging(false); }
  function handleDragOver(e) { e.preventDefault(); }
  function handleDrop(e) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCode(ev.target.result);
        setFilename(file.name);
        onToast?.(`Loaded: ${file.name}`);
      };
      reader.readAsText(file);
    }
  }

  // ── Reset to input ────────────────────────────────
  function handleNewScan() {
    setPhase('input');
    setCode('');
    setFilename('');
    setReportData(null);
    setFallbackContent('');
    setDeepDiveMessages([]);
    setScanError('');
  }

  // ── Back to report from deep-dive ─────────────────
  function handleBackToReport() {
    setPhase('report');
    setDeepDiveMessages([]);
    setDeepDiveInput('');
  }

  // ── Receive file from File Browser ────────────────
  const handleFileFromBrowser = useCallback((fileData) => {
    if (fileData?.content) {
      setCode(fileData.content);
      setFilename(fileData.name || fileData.path || '');
      onToast?.(`Loaded from file browser: ${fileData.name}`);
    }
  }, [onToast]);

  if (onAttachFromBrowser) {
    onAttachFromBrowser.current = handleFileFromBrowser;
  }

  // ── Render: Loading ───────────────────────────────
  if (phase === 'loading') {
    return <LoadingAnimation filename={filename} />;
  }

  // ── Render: Security Report ───────────────────────
  if (phase === 'report' && reportData) {
    return (
      <section className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" aria-label="Security scan report">
        {savedPentest && (
          <div className="max-w-3xl mx-auto mb-3 flex items-center gap-2 text-xs text-slate-500">
            <History className="w-3.5 h-3.5" />
            <span>Saved scan</span>
          </div>
        )}
        <SecurityReport
          data={reportData}
          filename={filename}
          onDeepDive={handleDeepDive}
          onNewScan={handleNewScan}
          onToast={onToast}
        />
      </section>
    );
  }

  // ── Render: Fallback (streaming markdown) ─────────
  if (phase === 'fallback') {
    return (
      <section className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" aria-label="Security scan (conversation mode)">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="glass rounded-xl border border-amber-500/20 p-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <p className="text-xs text-amber-300">
              Structured report unavailable -- showing analysis as conversation
            </p>
          </div>
          <div className="glass rounded-xl border border-slate-700/30 p-4">
            {fallbackContent ? (
              <MarkdownContent content={fallbackContent} />
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                <span className="text-sm">Scanning for vulnerabilities...</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleNewScan}
              className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 transition-colors cursor-pointer"
            >
              New Scan
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: Deep Dive Conversation ────────────────
  if (phase === 'deep-dive') {
    const visibleMessages = deepDiveMessages.filter(m => m.role === 'user' || m.role === 'assistant');

    return (
      <section className="flex-1 flex flex-col min-h-0 overflow-hidden" aria-label="Deep dive conversation">
        <div className="glass border-b border-slate-700/30 px-4 py-2 flex items-center gap-3">
          <button
            onClick={handleBackToReport}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-700/40 transition-colors cursor-pointer"
          >
            ← Back to Report
          </button>
          <span className="text-xs text-slate-500">Security Deep Dive</span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" role="log" aria-label="Deep dive messages" aria-live="polite">
          {visibleMessages.map((msg, i) => (
            <MessageBubble key={i} role={msg.role} content={msg.content} streaming={deepDiveStreaming && i === visibleMessages.length - 1 && msg.role === 'assistant'} />
          ))}
          {deepDiveStreaming && visibleMessages.length > 0 && visibleMessages[visibleMessages.length - 1]?.role !== 'assistant' && (
            <div className="flex items-center gap-2 text-slate-400 text-sm py-2 px-4" role="status" aria-live="polite">
              <div className="flex gap-1">
                <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="inline-block w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span>Thinking...</span>
            </div>
          )}
          <div ref={deepDiveEndRef} />
        </div>

        <div className="glass-heavy border-t border-slate-700/30 p-4">
          <div className="flex gap-2">
            <label htmlFor="pentest-deep-dive-input" className="sr-only">Ask a follow-up question</label>
            <textarea
              id="pentest-deep-dive-input"
              ref={deepDiveInputRef}
              value={deepDiveInput}
              onChange={e => setDeepDiveInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDeepDiveFollowUp(); } }}
              placeholder="Ask a follow-up question about this security finding..."
              rows={2}
              disabled={deepDiveStreaming || !connected}
              className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
            />
            <button
              onClick={handleDeepDiveFollowUp}
              disabled={!deepDiveInput.trim() || deepDiveStreaming || !connected}
              className="btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px] cursor-pointer"
            >
              {deepDiveStreaming ? '...' : 'Ask'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ── Render: Input Phase ───────────────────────────
  return (
    <section
      className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4"
      aria-label="Security scan input"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
            Security Scan
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Submit code for an OWASP security assessment. You'll get a structured report with grades
            across 6 security categories and actionable fix prompts.
          </p>
        </div>

        {/* Error */}
        {scanError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <span className="text-red-400 shrink-0">✕</span>
            <p className="text-sm text-red-300">{scanError}</p>
          </div>
        )}

        {/* Drag overlay */}
        {dragging && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-base/80 border-2 border-dashed border-orange-500 rounded-2xl m-2 pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-2">🛡️</div>
              <p className="text-orange-300 font-medium neon-text">Drop a file to scan</p>
            </div>
          </div>
        )}

        {/* Code Input - Tab-based interface */}
        <div className="glass rounded-xl border border-slate-700/30 p-4 space-y-4">
          <Tab.Group>
            <Tab.List className="flex gap-2 border-b border-slate-700/30 mb-4">
              <Tab className={({ selected }) =>
                `flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                  selected
                    ? 'border-b-2 border-orange-500 text-white -mb-px'
                    : 'text-slate-400 hover:text-slate-300'
                }`
              }>
                <FileText className="w-4 h-4" />
                Paste Code
              </Tab>
              <Tab className={({ selected }) =>
                `flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                  selected
                    ? 'border-b-2 border-orange-500 text-white -mb-px'
                    : 'text-slate-400 hover:text-slate-300'
                }`
              }>
                <UploadIcon className="w-4 h-4" />
                Upload File
              </Tab>
              <Tab className={({ selected }) =>
                `flex items-center gap-2 px-4 py-2 text-sm transition-colors cursor-pointer ${
                  selected
                    ? 'border-b-2 border-orange-500 text-white -mb-px'
                    : 'text-slate-400 hover:text-slate-300'
                }`
              }>
                <FolderOpen className="w-4 h-4" />
                Browse Files
              </Tab>
            </Tab.List>

            <Tab.Panels>
              {/* Paste Code Panel */}
              <Tab.Panel className="space-y-3">
                <div>
                  <label htmlFor="pentest-filename" className="text-xs text-slate-400 block mb-1">
                    Filename <span className="text-slate-600">(optional -- helps the AI understand context)</span>
                  </label>
                  <input
                    id="pentest-filename"
                    type="text"
                    value={filename}
                    onChange={e => setFilename(e.target.value)}
                    placeholder="e.g. server.js, utils/auth.py"
                    className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="pentest-code" className="text-xs text-slate-400 block mb-1">
                    Code to scan
                  </label>
                  <textarea
                    id="pentest-code"
                    ref={textareaRef}
                    value={code}
                    onChange={e => { setCode(e.target.value); if (!filename) setFilename(''); }}
                    placeholder="Paste your code here for OWASP security analysis..."
                    rows={16}
                    className="w-full input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-y placeholder-slate-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setCode(''); setFilename(''); }}
                    title="Clear code input"
                    disabled={!code}
                    className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-slate-700/30 hover:border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </Tab.Panel>

              {/* Upload File Panel */}
              <Tab.Panel>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragging
                      ? 'border-orange-500 bg-orange-500/10'
                      : 'border-slate-700/40 hover:border-slate-600/60'
                  }`}
                  onDragEnter={handleDragEnter}
                  onDragLeave={handleDragLeave}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".js,.jsx,.ts,.tsx,.py,.json,.md,.txt,.html,.css,.yaml,.yml,.sh,.sql,.go,.rs,.java,.c,.cpp,.h,.toml,.xml,.csv,.env,.svelte,.vue,.rb,.php,.swift,.kt,.dart,.zig,.ex,.exs,.erl,.hs,.ml,.clj,.scala,.r,.lua,.pl,.ps1"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <UploadIcon className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-300 mb-2">Drag and drop a file, or click to browse</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-sm px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Choose File
                  </button>
                  {filename && (
                    <p className="text-xs text-emerald-400 mt-3">
                      Loaded: <span className="font-mono">{filename}</span>
                    </p>
                  )}
                </div>
              </Tab.Panel>

              {/* Browse Files Panel */}
              <Tab.Panel>
                <div className="text-center py-8 space-y-4">
                  <FolderOpen className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-400">Browse files from your project folder</p>
                  <button
                    onClick={onOpenFileBrowser}
                    className="text-sm px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors cursor-pointer"
                  >
                    Open File Browser
                  </button>
                  {filename && (
                    <p className="text-xs text-emerald-400 mt-3">
                      Loaded: <span className="font-mono">{filename}</span>
                    </p>
                  )}
                </div>
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>

        {/* Model capability warning */}
        {showModelWarning && connected && selectedModel && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm text-amber-300">
                {modelTier === 'weak'
                  ? 'This model is very small and will likely struggle with security analysis. You may get a conversational fallback instead of a structured report.'
                  : 'Smaller models may miss vulnerabilities or produce less accurate severity ratings. Security analysis needs strong reasoning.'}
              </p>
              {suggestedModel && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-amber-200/80">
                    For better results, try <strong>{suggestedModel.name}</strong>
                  </p>
                  <button
                    onClick={() => onSetSelectedModel?.(suggestedModel.name)}
                    className="px-3 py-1 text-sm font-medium text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Switch
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmitScan}
            disabled={!code.trim() || !selectedModel || !connected || isLoading}
            className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl px-8 py-3 font-medium text-base transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-orange-500/20"
          >
            {!connected ? 'Connect to Ollama First' : !selectedModel ? 'Select a Model' : 'Scan for Vulnerabilities'}
          </button>
        </div>

        {/* Tips */}
        <div className="glass rounded-xl border border-slate-700/20 p-4 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">Tips for best results:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Submit one file at a time for more focused security analysis</li>
            <li>Include the filename so the AI understands the file type and context</li>
            <li>Larger models (13B+) produce more accurate OWASP vulnerability assessments</li>
            <li>Use Deep Dive on any category to get detailed remediation guidance</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
