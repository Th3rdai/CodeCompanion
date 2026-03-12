import { useState, useEffect } from 'react';

function StatusDot({ status }) {
  const colors = {
    connected: 'bg-green-400',
    disconnected: 'bg-slate-400',
    error: 'bg-red-400',
  };
  return <div className={`w-2.5 h-2.5 rounded-full ${colors[status] || colors.disconnected}`} />;
}

function AddServerModal({ onAdd, onClose }) {
  const [name, setName] = useState('');
  const [transport, setTransport] = useState('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [envVars, setEnvVars] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  function buildPayload() {
    return {
      transport,
      command: transport === 'stdio' ? command : undefined,
      url: transport === 'http' ? command : undefined,
      args: args ? args.split('\n').filter(a => a.trim()) : [],
      env: envVars ? Object.fromEntries(envVars.split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; })) : {},
    };
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/mcp/clients/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      setTestResult(data.success ? { ok: true, tools: data.tools } : { ok: false, error: data.error });
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    }
    setTesting(false);
  }

  async function handleSave() {
    if (!name.trim() || !command.trim()) {
      setTestResult({ ok: false, error: 'Name and command/URL are required' });
      return;
    }
    // Generate id from name: lowercase, replace spaces/special chars with hyphens
    const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      const res = await fetch('/api/mcp/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, autoConnect: true, ...buildPayload() }),
      });
      const data = await res.json();
      if (data.id) {
        // Auto-connect after saving
        await fetch(`/api/mcp/clients/${id}/connect`, { method: 'POST' });
        onAdd();
        onClose();
      } else {
        setTestResult({ ok: false, error: data.error || 'Failed to save' });
      }
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-heavy rounded-2xl w-full max-w-md p-6 neon-border" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-100 neon-text mb-4">Add MCP Server</h3>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Server Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g., My MCP Server"
              className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-sm" />
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Transport Type</label>
            <select value={transport} onChange={e => setTransport(e.target.value)}
              className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-sm">
              <option value="stdio">Stdio (Local Command)</option>
              <option value="http">HTTP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">
              {transport === 'stdio' ? 'Command' : 'URL'}
            </label>
            <input type="text" value={command} onChange={e => setCommand(e.target.value)}
              placeholder={transport === 'stdio' ? 'node server.js' : 'http://localhost:3001/mcp'}
              className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-sm" />
          </div>

          {transport === 'stdio' && (
            <>
              <div>
                <label className="block text-sm text-slate-300 mb-1 font-medium">Arguments (one per line)</label>
                <textarea value={args} onChange={e => setArgs(e.target.value)} placeholder="--debug&#10;--port 3001"
                  className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-sm" rows={2} />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1 font-medium">Environment Variables (KEY=VALUE)</label>
                <textarea value={envVars} onChange={e => setEnvVars(e.target.value)} placeholder="DEBUG=true&#10;PORT=3001"
                  className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-sm" rows={2} />
              </div>
            </>
          )}
        </div>

        {testResult && (
          <div className={`mb-4 p-2.5 rounded-lg text-xs ${testResult.ok ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {testResult.ok ? `Connection successful! Found ${testResult.tools?.length || 0} tools.` : `Error: ${testResult.error}`}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={handleTest} disabled={testing || !command.trim()}
            className="px-3 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50">
            {testing ? '...' : 'Test'}
          </button>
          <button onClick={onClose} className="px-3 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleSave}
            className="px-3 py-2 btn-neon text-white rounded-lg text-sm font-medium">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function McpClientPanel() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    try {
      const res = await fetch('/api/mcp/clients');
      const data = await res.json();
      // API returns array directly
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    }
    setLoading(false);
  }

  async function handleConnect(id) {
    try {
      await fetch(`/api/mcp/clients/${id}/connect`, { method: 'POST' });
      fetchClients();
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  }

  async function handleDisconnect(id) {
    try {
      await fetch(`/api/mcp/clients/${id}/disconnect`, { method: 'POST' });
      fetchClients();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  }

  async function handleRemove(id) {
    if (confirm('Remove this server connection?')) {
      try {
        await fetch(`/api/mcp/clients/${id}`, { method: 'DELETE' });
        fetchClients();
      } catch (err) {
        console.error('Failed to remove:', err);
      }
    }
  }

  if (loading) {
    return <div className="text-center py-8 text-slate-400">Loading servers...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">External MCP Servers</h3>
        <button onClick={() => setShowAddModal(true)}
          className="btn-neon text-white rounded-lg px-3 py-1.5 text-xs font-medium">
          + Add Server
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="p-8 text-center text-slate-400 glass rounded-lg border border-slate-700/30">
          <p className="text-sm mb-3">No external MCP servers configured</p>
          <button onClick={() => setShowAddModal(true)}
            className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium">
            Add Your First Server
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {clients.map(client => (
            <div key={client.id} className="p-4 glass rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusDot status={client.status || 'disconnected'} />
                    <h4 className="font-medium text-slate-200">{client.name}</h4>
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">
                      {client.transport === 'stdio' ? '📟 Stdio' : '🌐 HTTP'}
                    </span>
                    {client.toolCount > 0 && (
                      <span className="text-xs text-slate-500">{client.toolCount} tools</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono">
                    {client.transport === 'stdio' ? client.command : client.url}
                  </p>
                  {client.error && (
                    <p className="text-xs text-red-400 mt-1">{client.error}</p>
                  )}
                </div>
                <div className="flex gap-1.5">
                  {client.status === 'connected' ? (
                    <button onClick={() => handleDisconnect(client.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                      Disconnect
                    </button>
                  ) : (
                    <button onClick={() => handleConnect(client.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors">
                      Connect
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5 justify-end pt-2 border-t border-slate-700/30">
                <button onClick={() => handleRemove(client.id)}
                  className="text-xs px-2.5 py-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && <AddServerModal onAdd={fetchClients} onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
