import { useState, useEffect } from 'react';

// Actual Code Companion MCP tool names (must match mcp/tools.js)
const ALL_TOOLS = [
  { id: 'codecompanion_chat', name: 'Chat', desc: 'General conversational mode for PMs' },
  { id: 'codecompanion_explain', name: 'Explain Code', desc: 'Explains code in plain English' },
  { id: 'codecompanion_find_bugs', name: 'Find Bugs', desc: 'Reviews code for bugs and security issues' },
  { id: 'codecompanion_refactor', name: 'Refactor', desc: 'Suggests refactoring improvements' },
  { id: 'codecompanion_tech_to_biz', name: 'Tech → Business', desc: 'Translates technical content to business language' },
  { id: 'codecompanion_biz_to_tech', name: 'Business → Tech', desc: 'Translates business requirements to tech specs' },
  { id: 'codecompanion_list_models', name: 'List Models', desc: 'Lists available Ollama models' },
  { id: 'codecompanion_get_status', name: 'Get Status', desc: 'Returns connection status and configuration' },
  { id: 'codecompanion_browse_files', name: 'Browse Files', desc: 'Lists the project file tree' },
  { id: 'codecompanion_read_file', name: 'Read File', desc: 'Reads a file from the project folder' },
  { id: 'codecompanion_list_conversations', name: 'List Conversations', desc: 'Lists saved conversation history' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="text-xs text-slate-400 hover:text-indigo-300 px-2 py-1 rounded-lg transition-colors"
      aria-label="Copy to clipboard">
      {copied ? '✓' : '📋'}
    </button>
  );
}

export default function McpServerPanel() {
  const [enabled, setEnabled] = useState(false);
  const [disabledTools, setDisabledTools] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedConfig, setExpandedConfig] = useState(false);

  useEffect(() => {
    fetchStatus();
    fetchStats();
  }, []);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/mcp/server/status');
      const data = await res.json();
      setEnabled(data.httpEnabled !== false);
      setDisabledTools(data.disabledTools || []);
    } catch (err) {
      console.error('Failed to fetch server status:', err);
    }
    setLoading(false);
  }

  async function fetchStats() {
    try {
      const res = await fetch('/api/mcp/server/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch server stats:', err);
    }
  }

  async function handleToggleServer() {
    try {
      const res = await fetch('/api/mcp/server/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      const data = await res.json();
      setEnabled(data.httpEnabled !== false);
      fetchStats();
    } catch (err) {
      console.error('Failed to toggle server:', err);
    }
  }

  async function handleToolToggle(toolId) {
    let newDisabled;
    if (disabledTools.includes(toolId)) {
      newDisabled = disabledTools.filter(t => t !== toolId);
    } else {
      newDisabled = [...disabledTools, toolId];
    }
    try {
      await fetch('/api/mcp/server/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabledTools: newDisabled }),
      });
      setDisabledTools(newDisabled);
      fetchStats();
    } catch (err) {
      console.error('Failed to toggle tool:', err);
    }
  }

  const claudeDesktopConfig = {
    mcpServers: {
      codeCompanion: {
        command: 'node',
        args: ['mcp-server.js'],
      },
    },
  };

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading server status...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Server Status */}
      <div className="p-4 glass rounded-lg border border-slate-700/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-200">HTTP Endpoint</h3>
          <button onClick={handleToggleServer}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-green-600' : 'bg-slate-700'}`}
            role="switch" aria-checked={enabled}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-2.5 h-2.5 rounded-full ${enabled ? 'bg-green-400' : 'bg-red-400'}`} />
          <span className={`text-sm ${enabled ? 'text-green-400' : 'text-red-400'}`}>{enabled ? 'Active' : 'Disabled'}</span>
        </div>
        {enabled && (
          <div className="space-y-2.5">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Endpoint URL</label>
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
                <code className="flex-1 text-xs text-indigo-300 font-mono">http://localhost:3000/mcp</code>
                <CopyButton text="http://localhost:3000/mcp" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Stdio Command</label>
              <div className="flex items-center gap-2 bg-slate-800/50 rounded-lg px-3 py-2">
                <code className="flex-1 text-xs text-indigo-300 font-mono">node mcp-server.js</code>
                <CopyButton text="node mcp-server.js" />
              </div>
            </div>
            <div>
              <button onClick={() => setExpandedConfig(!expandedConfig)}
                className="text-xs text-indigo-300 hover:text-indigo-200 font-medium">
                {expandedConfig ? '▼' : '▶'} Claude Desktop Configuration
              </button>
              {expandedConfig && (
                <div className="mt-2 bg-slate-800/50 rounded-lg p-3 relative">
                  <pre className="text-xs text-slate-300 font-mono overflow-x-auto">
{JSON.stringify(claudeDesktopConfig, null, 2)}
                  </pre>
                  <CopyButton text={JSON.stringify(claudeDesktopConfig, null, 2)} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Tools Management */}
      <div className="p-4 glass rounded-lg border border-slate-700/30">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Available Tools</h3>
        <div className="space-y-2">
          {ALL_TOOLS.map(tool => {
            const isEnabled = !disabledTools.includes(tool.id);
            return (
              <div key={tool.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-slate-700/20 transition-colors">
                <div className="flex-1">
                  <div className="text-sm text-slate-300 font-medium">{tool.name}</div>
                  <div className="text-xs text-slate-500">{tool.desc}</div>
                </div>
                <button onClick={() => handleToolToggle(tool.id)} disabled={!enabled}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isEnabled ? 'bg-green-600' : 'bg-slate-700'} ${!enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  role="switch" aria-checked={isEnabled}>
                  <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Usage Stats */}
      {stats && (
        <div className="p-4 glass rounded-lg border border-slate-700/30">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Usage Statistics</h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-400">{stats.totalCalls || 0}</div>
              <div className="text-xs text-slate-500">Total Calls</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-400">{stats.callsToday || 0}</div>
              <div className="text-xs text-slate-500">Today</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-indigo-400">{stats.lastCallAt ? new Date(stats.lastCallAt).toLocaleTimeString() : '—'}</div>
              <div className="text-xs text-slate-500">Last Call</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
