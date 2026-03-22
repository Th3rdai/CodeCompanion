import { useState, useRef, useEffect } from 'react';
import { apiFetch } from '../lib/api-fetch';

const FORMAT_GROUPS = [
  {
    label: 'Text',
    formats: [
      { ext: '.md',   label: 'Markdown',     icon: '📝' },
      { ext: '.txt',  label: 'Plain Text',   icon: '📄' },
      { ext: '.html', label: 'HTML',          icon: '🌐' },
      { ext: '.json', label: 'JSON',          icon: '{ }' },
    ],
  },
  {
    label: 'Documents',
    formats: [
      { ext: '.pdf',  label: 'PDF',           icon: '📕' },
      { ext: '.docx', label: 'Word',          icon: '📘' },
      { ext: '.odt',  label: 'OpenDoc Text',  icon: '📃' },
    ],
  },
  {
    label: 'Spreadsheets',
    formats: [
      { ext: '.xlsx', label: 'Excel',         icon: '📗' },
      { ext: '.ods',  label: 'OpenDoc Sheet', icon: '📊' },
      { ext: '.csv',  label: 'CSV',           icon: '📋' },
    ],
  },
  {
    label: 'Presentations',
    formats: [
      { ext: '.pptx', label: 'PowerPoint',    icon: '📙' },
    ],
  },
];

/**
 * Export panel — dropdown with format checkboxes.
 *
 * Props:
 *   messages: Array of { role, content }
 *   mode: current mode label
 *   showToast: function(msg)
 */
export default function ExportPanel({ messages, mode, showToast }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [source, setSource] = useState('conversation'); // 'conversation' | 'lastResponse'
  const [downloading, setDownloading] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  function toggleFormat(ext) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext);
      else next.add(ext);
      return next;
    });
  }

  function selectAll() {
    const all = FORMAT_GROUPS.flatMap(g => g.formats.map(f => f.ext));
    setSelected(new Set(all));
  }

  function selectNone() {
    setSelected(new Set());
  }

  function buildContent() {
    if (!messages || messages.length === 0) return null;

    if (source === 'lastResponse') {
      const last = [...messages].reverse().find(m => m.role === 'assistant');
      return last?.content || null;
    }

    // Full conversation
    const date = new Date().toISOString().slice(0, 10);
    const lines = [`# ${mode || 'Chat'} — ${date}\n`];
    for (const msg of messages) {
      if (msg.role === 'user') lines.push(`## You\n\n${msg.content}\n`);
      else if (msg.role === 'assistant') lines.push(`## Assistant\n\n${msg.content}\n`);
    }
    return lines.join('\n');
  }

  function buildFilename(ext) {
    const date = new Date().toISOString().slice(0, 10);
    const firstUser = messages?.find(m => m.role === 'user');
    const snippet = firstUser
      ? firstUser.content.replace(/[^a-zA-Z0-9 ]/g, '').trim().split(/\s+/).slice(0, 2).join('-').toLowerCase() || 'export'
      : 'export';
    return `${snippet}-${date}${ext}`;
  }

  async function handleExport() {
    const content = buildContent();
    if (!content) { showToast('Nothing to export'); return; }
    if (selected.size === 0) { showToast('Select at least one format'); return; }

    setDownloading(true);

    // Ask about multi-format delivery if more than one selected
    let useZip = false;
    if (selected.size > 1) {
      useZip = window.confirm(
        `You selected ${selected.size} formats.\n\nOK = Download as ZIP\nCancel = Download each file separately`
      );
    }

    const formats = [...selected];

    if (useZip) {
      // Generate all files and bundle into a ZIP
      try {
        showToast(`Generating ${formats.length} files...`);
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();

        for (const ext of formats) {
          const filename = buildFilename(ext);
          const res = await apiFetch('/api/generate-office', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, filename }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(`${ext} failed: ${err.error || 'Unknown error'}`);
            continue;
          }
          const blob = await res.blob();
          zip.file(filename, blob);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export-${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`ZIP with ${formats.length} files saved`);
      } catch (err) {
        showToast(`Export failed: ${err.message}`);
      }
    } else {
      // Sequential downloads
      for (const ext of formats) {
        try {
          const filename = buildFilename(ext);
          showToast(`Generating ${ext.slice(1).toUpperCase()}...`);
          const res = await apiFetch('/api/generate-office', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, filename }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            showToast(`${ext} failed: ${err.error || 'Unknown error'}`);
            continue;
          }
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        } catch (err) {
          showToast(`${ext} failed: ${err.message}`);
        }
      }
      showToast(`${formats.length} file${formats.length > 1 ? 's' : ''} exported`);
    }

    setDownloading(false);
    setOpen(false);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="text-xs px-2.5 py-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        title="Export conversation"
      >
        📥 Export
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 glass rounded-xl border border-slate-700/40 shadow-2xl z-50 p-3 space-y-3">
          {/* Source selector */}
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-medium">Export Source</p>
            <div className="flex gap-1.5">
              {[
                { id: 'conversation', label: 'Full Chat' },
                { id: 'lastResponse', label: 'Last Response' },
              ].map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSource(s.id)}
                  className={`text-xs px-2.5 py-1 rounded-lg transition-colors ${
                    source === s.id
                      ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 border border-transparent'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Format checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 font-medium">Formats</p>
              <div className="flex gap-2">
                <button type="button" onClick={selectAll} className="text-[10px] text-indigo-400 hover:text-indigo-300">All</button>
                <button type="button" onClick={selectNone} className="text-[10px] text-slate-500 hover:text-slate-300">None</button>
              </div>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {FORMAT_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[9px] uppercase tracking-wider text-slate-600 mb-1">{group.label}</p>
                  <div className="grid grid-cols-2 gap-1">
                    {group.formats.map(f => (
                      <label
                        key={f.ext}
                        className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md cursor-pointer transition-colors ${
                          selected.has(f.ext)
                            ? 'bg-indigo-600/20 text-indigo-300'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(f.ext)}
                          onChange={() => toggleFormat(f.ext)}
                          className="sr-only"
                        />
                        <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center text-[8px] ${
                          selected.has(f.ext) ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600'
                        }`}>
                          {selected.has(f.ext) && '✓'}
                        </span>
                        <span>{f.icon}</span>
                        <span>{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export button */}
          <button
            type="button"
            onClick={handleExport}
            disabled={downloading || selected.size === 0}
            className="w-full btn-neon text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {downloading
              ? 'Exporting...'
              : selected.size === 0
                ? 'Select formats'
                : `Export ${selected.size} format${selected.size > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}
