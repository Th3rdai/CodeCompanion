import { useState, useRef, useCallback, useEffect } from 'react';
import { Tab } from '@headlessui/react';
import { FileText, Upload as UploadIcon, FolderOpen } from 'lucide-react';
import ReportCard from './ReportCard';
import MessageBubble from './MessageBubble';
import DictateButton from './DictateButton';
import MarkdownContent from './MarkdownContent';
import LoadingAnimation from './LoadingAnimation';

// ── Model capability detection ────────────────────────
// Returns a warning message if the model is likely too small for structured review output.
function getModelCapabilityWarning(modelName) {
  if (!modelName) return null;
  const name = modelName.toLowerCase();
  // Detect small models by parameter count in name
  if (/(?:^|[^0-9])(?:0\.5b|1b|1\.5b|2b|3b)(?:$|[^0-9])/.test(name)) {
    return 'This model is very small and will likely struggle to produce a structured report card. For best results, use a 13B+ model (e.g. llama3:13b, codellama:13b). You may get a conversational fallback instead.';
  }
  if (/(?:^|[^0-9])(?:7b|8b)(?:$|[^0-9])/.test(name)) {
    return 'Smaller models (7-8B) can produce report cards but may miss issues or produce less accurate grades. For thorough reviews, consider a 13B+ model.';
  }
  return null;
}

// ── Review Panel ────────────────────────────────────
// Full Review mode: input methods, report card display,
// fallback streaming, deep-dive conversation, and history persistence.

export default function ReviewPanel({
  selectedModel,
  connected,
  streaming: appStreaming,
  onAttachFromBrowser,
  onOpenFileBrowser,
  onToast,
  onSwitchToChat,
  savedReview,
  onSaveReview,
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
  const [reviewError, setReviewError] = useState('');
  const [dragging, setDragging] = useState(false);

  const modelWarning = getModelCapabilityWarning(selectedModel);

  // ── Restore saved review from history ───────────────
  useEffect(() => {
    if (savedReview) {
      if (savedReview.reportData) {
        setReportData(savedReview.reportData);
        setFilename(savedReview.filename || '');
        setCode(savedReview.code || '');
        setPhase('report');
      } else if (savedReview.fallbackContent) {
        setFallbackContent(savedReview.fallbackContent);
        setFilename(savedReview.filename || '');
        setCode(savedReview.code || '');
        setPhase('fallback');
      }
    }
  }, [savedReview]);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const deepDiveInputRef = useRef(null);
  const dragCounter = useRef(0);
  const deepDiveEndRef = useRef(null);

  const isLoading = phase === 'loading';

  // ── Submit review ─────────────────────────────────
  const handleSubmitReview = useCallback(async () => {
    if (!code.trim() || !selectedModel || isLoading) return;

    setPhase('loading');
    setReviewError('');
    setReportData(null);
    setFallbackContent('');

    // DEBUG: Log what we're sending
    const trimmedCode = code.trim();
    console.log('=== REVIEW SUBMIT DEBUG ===');
    console.log('Code length:', trimmedCode.length);
    console.log('Has CRLF (\\r\\n):', trimmedCode.includes('\r\n'));
    console.log('Has LF only (\\n):', trimmedCode.includes('\n') && !trimmedCode.includes('\r\n'));
    console.log('Line count:', trimmedCode.split('\n').length);
    console.log('First 100 chars:', trimmedCode.slice(0, 100));
    console.log('Last 100 chars:', trimmedCode.slice(-100));
    console.log('Char codes (first 50):', trimmedCode.slice(0, 50).split('').map(c => c.charCodeAt(0)).join(','));
    console.log('Filename:', filename || 'undefined');
    console.log('Model:', selectedModel);
    console.log('==========================');

    try {
      const res = await fetch('/api/review', {
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
        // Structured report card
        const result = await res.json();
        if (result.type === 'report-card' && result.data) {
          setReportData(result.data);
          setPhase('report');
          // Persist to review history
          onSaveReview?.({
            reportData: result.data,
            filename: filename || undefined,
            code: code.trim(),
            model: selectedModel,
          });
          return;
        }
        // Error JSON
        setReviewError(result.error || 'Unexpected response from review endpoint.');
        setPhase('input');
        return;
      }

      if (contentType.includes('text/event-stream')) {
        // SSE fallback stream
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
        // Persist fallback review to history
        onSaveReview?.({
          fallbackContent: accumulated,
          filename: filename || undefined,
          code: code.trim(),
          model: selectedModel,
        });
        return;
      }

      // Unexpected content type
      const text = await res.text();
      setReviewError(`Unexpected response: ${text.slice(0, 200)}`);
      setPhase('input');
    } catch (err) {
      setReviewError(`Connection failed: ${err.message}`);
      setPhase('input');
    }
  }, [code, filename, selectedModel, isLoading]);

  // ── Deep dive into a finding ──────────────────────
  const handleDeepDive = useCallback((finding, categoryKey) => {
    const context = `I just reviewed some code and found this issue:\n\n**Category:** ${categoryKey}\n**Finding:** ${finding.title} (${finding.severity})\n**Details:** ${finding.explanation}${finding.analogy ? `\n**Analogy:** ${finding.analogy}` : ''}\n\nHere is the original code:\n\`\`\`\n${code.trim()}\n\`\`\``;

    const systemMsg = {
      role: 'system',
      content: `You are a senior developer helping a Product Manager understand a code review finding in depth. The PM found an issue during a code review and wants to understand it better. Explain clearly, use analogies when helpful, and suggest specific fixes with code examples. Never use jargon without explanation.`,
    };

    const userMsg = {
      role: 'user',
      content: `I want to understand this finding better and know how to fix it:\n\n**${finding.title}** (${finding.severity} severity, ${categoryKey} category)\n\n${finding.explanation}\n\nCan you explain what exactly is wrong, show me how to fix it, and tell me what the fix would look like?`,
    };

    setDeepDiveMessages([
      { role: 'context', content: context },
      systemMsg,
      userMsg,
    ]);
    setDeepDiveInput('');
    setPhase('deep-dive');

    // Auto-send the initial deep-dive question
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

      // Ensure final message is set
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

  // ── Paste from clipboard ──────────────────────────
  async function handlePasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      setCode(prev => prev + text);
      textareaRef.current?.focus();
      onToast?.('Pasted from clipboard');
    } catch {
      onToast?.('Clipboard access denied');
    }
  }

  // ── Dictation result ──────────────────────────────
  function handleDictation(text) {
    setCode(prev => (prev ? prev + ' ' + text : text));
  }

  // ── Reset to input ────────────────────────────────
  function handleNewReview() {
    setPhase('input');
    setCode('');
    setFilename('');
    setReportData(null);
    setFallbackContent('');
    setDeepDiveMessages([]);
    setReviewError('');
  }

  // ── Back to report from deep-dive ─────────────────
  function handleBackToReport() {
    setPhase('report');
    setDeepDiveMessages([]);
    setDeepDiveInput('');
  }

  // ── Receive file from File Browser ────────────────
  // This is called externally via a ref or prop callback
  // when the user clicks "attach" in the file browser.
  // We accept it as: { name, content, path }
  const handleFileFromBrowser = useCallback((fileData) => {
    if (fileData?.content) {
      setCode(fileData.content);
      setFilename(fileData.name || fileData.path || '');
      onToast?.(`Loaded from file browser: ${fileData.name}`);
    }
  }, [onToast]);

  // Expose file-from-browser handler
  if (onAttachFromBrowser) {
    onAttachFromBrowser.current = handleFileFromBrowser;
  }

  // ── Render: Loading ───────────────────────────────
  if (phase === 'loading') {
    return <LoadingAnimation filename={filename} />;
  }

  // ── Render: Report Card ───────────────────────────
  if (phase === 'report' && reportData) {
    return (
      <section className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" aria-label="Code review report card">
        <ReportCard
          data={reportData}
          filename={filename}
          onDeepDive={handleDeepDive}
          onNewReview={handleNewReview}
        />
      </section>
    );
  }

  // ── Render: Fallback (streaming markdown) ─────────
  if (phase === 'fallback') {
    return (
      <section className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4" aria-label="Code review (conversation mode)">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="glass rounded-xl border border-amber-500/20 p-3 flex items-center gap-2">
            <span className="text-amber-400">⚠️</span>
            <p className="text-xs text-amber-300">
              The model couldn't produce a structured report card, so here's a conversational review instead.
            </p>
          </div>
          <div className="glass rounded-xl border border-slate-700/30 p-4">
            {fallbackContent ? (
              <MarkdownContent content={fallbackContent} />
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
                <span className="text-sm">Streaming review...</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleNewReview}
              className="text-xs px-3 py-2 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-700/40 transition-colors"
            >
              Review Another
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
        {/* Header bar */}
        <div className="glass border-b border-slate-700/30 px-4 py-2 flex items-center gap-3">
          <button
            onClick={handleBackToReport}
            className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-slate-700/40 transition-colors"
          >
            ← Back to Report
          </button>
          <span className="text-xs text-slate-500">Deep Dive Conversation</span>
        </div>

        {/* Messages */}
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

        {/* Follow-up input */}
        <div className="glass-heavy border-t border-slate-700/30 p-4">
          <div className="flex gap-2">
            <label htmlFor="deep-dive-input" className="sr-only">Ask a follow-up question</label>
            <textarea
              id="deep-dive-input"
              ref={deepDiveInputRef}
              value={deepDiveInput}
              onChange={e => setDeepDiveInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDeepDiveFollowUp(); } }}
              placeholder="Ask a follow-up question about this finding..."
              rows={2}
              disabled={deepDiveStreaming || !connected}
              className="flex-1 input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-none placeholder-slate-500 disabled:opacity-50"
            />
            <button
              onClick={handleDeepDiveFollowUp}
              disabled={!deepDiveInput.trim() || deepDiveStreaming || !connected}
              className="btn-neon text-white rounded-xl px-4 font-medium transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed min-w-[60px]"
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
      aria-label="Code review input"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 py-4">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            Code Review
          </h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Submit code for a structured review. You'll get a color-coded report card with grades for
            bugs, security, readability, and completeness.
          </p>
        </div>

        {/* Error */}
        {reviewError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2">
            <span className="text-red-400 shrink-0">✕</span>
            <p className="text-sm text-red-300">{reviewError}</p>
          </div>
        )}

        {/* Drag overlay */}
        {dragging && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-base/80 border-2 border-dashed border-indigo-500 rounded-2xl m-2 pointer-events-none">
            <div className="text-center">
              <div className="text-4xl mb-2">📄</div>
              <p className="text-indigo-300 font-medium neon-text">Drop a file to review</p>
            </div>
          </div>
        )}

        {/* Code Input - Tab-based interface */}
        <div className="glass rounded-xl border border-slate-700/30 p-4 space-y-4">
          <Tab.Group>
            <Tab.List className="flex gap-2 border-b border-slate-700/30 mb-4">
              <Tab className={({ selected }) =>
                `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-b-2 border-indigo-500 text-white -mb-px'
                    : 'text-slate-400 hover:text-slate-300'
                }`
              }>
                <FileText className="w-4 h-4" />
                Paste Code
              </Tab>
              <Tab className={({ selected }) =>
                `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-b-2 border-indigo-500 text-white -mb-px'
                    : 'text-slate-400 hover:text-slate-300'
                }`
              }>
                <UploadIcon className="w-4 h-4" />
                Upload File
              </Tab>
              <Tab className={({ selected }) =>
                `flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                  selected
                    ? 'border-b-2 border-indigo-500 text-white -mb-px'
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
                  <label htmlFor="review-filename" className="text-xs text-slate-400 block mb-1">
                    Filename <span className="text-slate-600">(optional — helps the AI understand context)</span>
                  </label>
                  <input
                    id="review-filename"
                    type="text"
                    value={filename}
                    onChange={e => setFilename(e.target.value)}
                    placeholder="e.g. server.js, utils/auth.py"
                    className="w-full input-glow text-slate-200 text-sm rounded-lg px-3 py-2 placeholder-slate-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="review-code" className="text-xs text-slate-400 block mb-1">
                    Code to review
                  </label>
                  <textarea
                    id="review-code"
                    ref={textareaRef}
                    value={code}
                    onChange={e => { setCode(e.target.value); if (!filename) setFilename(''); }}
                    placeholder="Paste your code here..."
                    rows={16}
                    className="w-full input-glow text-slate-100 font-mono text-sm rounded-xl px-4 py-3 resize-y placeholder-slate-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handlePasteFromClipboard}
                    title="Paste code from clipboard"
                    className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors border border-slate-700/30 hover:border-indigo-500/30"
                  >
                    📋 Paste from Clipboard
                  </button>
                  <DictateButton
                    onResult={handleDictation}
                    disabled={!connected}
                    className="!w-auto !h-auto text-xs px-2.5 py-1.5 !rounded-lg border border-slate-700/30 hover:border-indigo-500/30"
                  />
                  <button
                    onClick={() => { setCode(''); setFilename(''); }}
                    title="Clear code input"
                    disabled={!code}
                    className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors border border-slate-700/30 hover:border-red-500/30 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    🧹 Clear
                  </button>
                </div>
              </Tab.Panel>

              {/* Upload File Panel */}
              <Tab.Panel>
                <div
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                    dragging
                      ? 'border-indigo-500 bg-indigo-500/10'
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
                    className="text-sm px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
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
                    className="text-sm px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors"
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
        {modelWarning && connected && selectedModel && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
            <span className="text-amber-400 shrink-0 mt-0.5">⚠️</span>
            <p className="text-sm text-amber-300">{modelWarning}</p>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmitReview}
            disabled={!code.trim() || !selectedModel || !connected || isLoading}
            className="btn-neon text-white rounded-xl px-8 py-3 font-medium text-base transition-colors disabled:bg-slate-700 disabled:text-slate-500 disabled:border-slate-600 disabled:shadow-none disabled:cursor-not-allowed"
            title={modelWarning || undefined}
          >
            {!connected ? 'Connect to Ollama First' : !selectedModel ? 'Select a Model' : 'Run Code Review'}
          </button>
        </div>

        {/* Tips */}
        <div className="glass rounded-xl border border-slate-700/20 p-4 text-xs text-slate-500 space-y-1">
          <p className="font-medium text-slate-400">Tips for best results:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li>Submit one file or logical unit at a time for more focused reviews</li>
            <li>Include the filename so the AI understands the file type and context</li>
            <li>Larger models (13B+) produce more accurate structured report cards</li>
            <li>If the structured report fails, you'll get a conversational review as fallback</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
