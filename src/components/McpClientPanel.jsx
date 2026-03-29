import { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api-fetch';

function StatusDot({ status }) {
  const colors = {
    connected: 'bg-green-400',
    disconnected: 'bg-slate-400',
    error: 'bg-red-400',
  };
  return <div className={`w-2.5 h-2.5 rounded-full ${colors[status] || colors.disconnected}`} />;
}

function parseEnvLines(text) {
  if (!text || !text.trim()) return {};
  return Object.fromEntries(
    text
      .split('\n')
      .filter((l) => l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1)];
      })
  );
}

function transportLabel(t) {
  if (t === 'stdio') return '📟 Stdio';
  if (t === 'sse') return '📡 SSE';
  return '🌐 HTTP';
}

function ServerModal({ mode, client, onSaved, onClose }) {
  const isEdit = mode === 'edit';
  const [name, setName] = useState('');
  const [transport, setTransport] = useState('stdio');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [envVars, setEnvVars] = useState('');
  const [clearEnv, setClearEnv] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isEdit && client) {
      setName(client.name || '');
      setTransport(client.transport || 'stdio');
      setCommand(client.transport === 'stdio' ? client.command || '' : client.url || '');
      setArgs((client.args || []).join('\n'));
      setEnvVars('');
      setClearEnv(false);
      setAutoConnect(client.autoConnect !== false);
    }
  }, [isEdit, client]);

  function buildTransportPayload() {
    const isRemote = transport === 'http' || transport === 'sse';
    return {
      transport,
      command: transport === 'stdio' ? command : undefined,
      url: isRemote ? command : undefined,
      args: args ? args.split('\n').filter((a) => a.trim()) : [],
    };
  }

  /** Body for test-connection (always send env when user typed lines). */
  function buildTestBody() {
    const base = { ...buildTransportPayload() };
    if (transport === 'stdio' && envVars.trim()) {
      base.env = parseEnvLines(envVars);
    }
    return base;
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch('/api/mcp/clients/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildTestBody()),
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

    try {
      if (isEdit && client) {
        const body = {
          name: name.trim(),
          autoConnect,
          ...buildTransportPayload(),
        };
        if (clearEnv) {
          body.env = {};
        } else if (envVars.trim()) {
          body.env = parseEnvLines(envVars);
        }

        const res = await apiFetch(`/api/mcp/clients/${encodeURIComponent(client.id)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setTestResult({ ok: false, error: data.error || `Update failed (${res.status})` });
          return;
        }
        if (autoConnect) {
          await apiFetch(`/api/mcp/clients/${encodeURIComponent(client.id)}/connect`, { method: 'POST' });
        }
      } else {
        const id = name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');
        const res = await apiFetch('/api/mcp/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id,
            name: name.trim(),
            autoConnect,
            ...buildTransportPayload(),
            env: parseEnvLines(envVars),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.id) {
          setTestResult({ ok: false, error: data.error || 'Failed to save' });
          return;
        }
        if (autoConnect) {
          await apiFetch(`/api/mcp/clients/${encodeURIComponent(data.id)}/connect`, { method: 'POST' });
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="glass-heavy rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 neon-border" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-100 neon-text mb-4">
          {isEdit ? 'Edit MCP Server' : 'Add MCP Server'}
        </h3>

        {isEdit && client && (
          <p className="text-xs text-slate-500 mb-3 font-mono">
            ID: <span className="text-slate-400">{client.id}</span> (fixed)
          </p>
        )}

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Server Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My MCP Server"
              className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="mcp-auto-connect"
              type="checkbox"
              checked={autoConnect}
              onChange={(e) => setAutoConnect(e.target.checked)}
              className="rounded border-slate-600"
            />
            <label htmlFor="mcp-auto-connect" className="text-sm text-slate-300">
              Connect automatically after saving
            </label>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">Transport Type</label>
            <select
              value={transport}
              onChange={(e) => setTransport(e.target.value)}
              className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none text-sm"
            >
              <option value="stdio">Stdio (Local Command)</option>
              <option value="http">HTTP (Streamable HTTP)</option>
              <option value="sse">SSE (Server-Sent Events)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">{transport === 'stdio' ? 'Command' : 'URL'}</label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={
                transport === 'stdio'
                  ? 'node server.js'
                  : transport === 'sse'
                    ? 'http://localhost:8054/sse'
                    : 'http://localhost:3001/mcp'
              }
              className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-sm"
            />
          </div>

          {transport === 'stdio' && (
            <>
              <div>
                <label className="block text-sm text-slate-300 mb-1 font-medium">Arguments (one per line)</label>
                <textarea
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder={'--debug\n--port 3001'}
                  className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-sm"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1 font-medium">Environment Variables (KEY=VALUE)</label>
                {isEdit && (
                  <p className="text-xs text-slate-500 mb-1">
                    Leave blank to keep saved values. Enter new lines to replace all env vars for this server.
                  </p>
                )}
                <textarea
                  value={envVars}
                  onChange={(e) => {
                    setEnvVars(e.target.value);
                    if (e.target.value.trim()) setClearEnv(false);
                  }}
                  placeholder={'DEBUG=true\nPORT=3001'}
                  disabled={clearEnv}
                  className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-sm disabled:opacity-50"
                  rows={2}
                />
                {isEdit && (
                  <label className="flex items-center gap-2 mt-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={clearEnv}
                      onChange={(e) => {
                        setClearEnv(e.target.checked);
                        if (e.target.checked) setEnvVars('');
                      }}
                    />
                    Clear all environment variables
                  </label>
                )}
              </div>
            </>
          )}
        </div>

        {testResult && (
          <div
            className={`mb-4 p-2.5 rounded-lg text-xs ${
              testResult.ok
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {testResult.ok
              ? `Connection successful! Found ${testResult.tools?.length || 0} tools.`
              : `Error: ${testResult.error}`}
          </div>
        )}

        <div className="flex gap-2 justify-end flex-wrap">
          <button
            onClick={handleTest}
            disabled={testing || !command.trim()}
            className="px-3 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {testing ? '...' : 'Test'}
          </button>
          <button onClick={onClose} className="px-3 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-3 py-2 btn-neon text-white rounded-lg text-sm font-medium">
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
  const [fetchError, setFetchError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch('/api/mcp/clients');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : data.code === 'LOCAL_OR_API_KEY_REQUIRED'
              ? 'This request was blocked (use http://127.0.0.1 or set VITE_CC_API_KEY to match server CC_API_SECRET).'
              : `Could not load MCP clients (HTTP ${res.status}).`;
        setFetchError(msg);
        setClients([]);
        setLoading(false);
        return;
      }
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
      setFetchError(err.message || 'Network error');
      setClients([]);
    }
    setLoading(false);
  }

  async function handleConnect(id) {
    try {
      await apiFetch(`/api/mcp/clients/${encodeURIComponent(id)}/connect`, { method: 'POST' });
      fetchClients();
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  }

  async function handleDisconnect(id) {
    try {
      await apiFetch(`/api/mcp/clients/${encodeURIComponent(id)}/disconnect`, { method: 'POST' });
      fetchClients();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  }

  async function handleRemove(id) {
    if (confirm('Remove this server connection?')) {
      try {
        await apiFetch(`/api/mcp/clients/${encodeURIComponent(id)}`, { method: 'DELETE' });
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
      {fetchError && (
        <div
          className="p-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-300 text-xs leading-relaxed flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <span>{fetchError}</span>
          <button
            type="button"
            onClick={() => fetchClients()}
            className="shrink-0 px-2.5 py-1 rounded-md border border-red-500/50 hover:bg-red-500/20 text-red-200 text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">External MCP Servers</h3>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-neon text-white rounded-lg px-3 py-1.5 text-xs font-medium"
        >
          + Add Server
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="p-8 text-center text-slate-400 glass rounded-lg border border-slate-700/30">
          <p className="text-sm mb-3">No external MCP servers configured</p>
          <button onClick={() => setShowAddModal(true)} className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium">
            Add Your First Server
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {clients.map((client) => (
            <div
              key={client.id}
              className="p-4 glass rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-2 gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusDot status={client.status || 'disconnected'} />
                    <h4 className="font-medium text-slate-200">{client.name}</h4>
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">{transportLabel(client.transport)}</span>
                    {client.autoConnect === false && (
                      <span className="text-xs text-slate-500" title="Does not auto-connect on startup">
                        manual
                      </span>
                    )}
                    {client.toolCount > 0 && <span className="text-xs text-slate-500">{client.toolCount} tools</span>}
                  </div>
                  <p className="text-xs text-slate-500 font-mono break-all">
                    {client.transport === 'stdio' ? client.command : client.url}
                  </p>
                  {client.error && <p className="text-xs text-red-400 mt-1">{client.error}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {client.status === 'connected' ? (
                    <button
                      onClick={() => handleDisconnect(client.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(client.id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-green-400 hover:bg-green-500/10 transition-colors"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-1.5 justify-end pt-2 border-t border-slate-700/30">
                <button
                  onClick={() => setEditingClient(client)}
                  className="text-xs px-2.5 py-1 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-indigo-500/10 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleRemove(client.id)}
                  className="text-xs px-2.5 py-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <ServerModal mode="add" onSaved={fetchClients} onClose={() => setShowAddModal(false)} />
      )}
      {editingClient && (
        <ServerModal mode="edit" client={editingClient} onSaved={fetchClients} onClose={() => setEditingClient(null)} />
      )}
    </div>
  );
}
