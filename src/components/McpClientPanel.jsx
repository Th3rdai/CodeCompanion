import { useState, useEffect } from "react";
import { apiFetch } from "../lib/api-fetch";

/** Shown after MCP connect failures — matches structured lines in logs/app.log */
const MCP_APP_LOG_HINT =
  'For transport, URL, and command details, open logs/app.log on the machine running this app and search for "MCP connect failed" (same line includes client id and stdio command or remote URL).';

function StatusDot({ status }) {
  const colors = {
    connected: "bg-green-400",
    disconnected: "bg-slate-400",
    error: "bg-red-400",
  };
  return (
    <div
      className={`w-2.5 h-2.5 rounded-full ${colors[status] || colors.disconnected}`}
    />
  );
}

function parseEnvLines(text) {
  if (!text || !text.trim()) return {};
  return Object.fromEntries(
    text
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1)];
      }),
  );
}

function transportLabel(t) {
  if (t === "stdio") return "📟 Stdio";
  if (t === "sse") return "📡 SSE";
  return "🌐 HTTP";
}

const SERVICE_LABELS = {
  gmail: "Gmail",
  drive: "Drive",
  calendar: "Calendar",
  calendars: "Calendar",
  doc: "Docs",
  docs: "Docs",
  spreadsheet: "Sheets",
  sheet: "Sheets",
  chat: "Chat",
  form: "Forms",
  forms: "Forms",
  presentation: "Slides",
  task: "Tasks",
  tasks: "Tasks",
  contact: "Contacts",
  contacts: "Contacts",
  script: "Apps Script",
  custom: "Custom Search",
  search: "Search",
  google: "Google Auth",
};

function getGroup(toolName) {
  const parts = toolName.split("_");
  const key = parts.length >= 2 ? parts[1].toLowerCase() : "";
  return (
    SERVICE_LABELS[key] ||
    (key ? key.charAt(0).toUpperCase() + key.slice(1) : "General")
  );
}

function ToolsModal({ client, onSaved, onClose }) {
  const [tools, setTools] = useState([]);
  const [disabled, setDisabled] = useState(new Set(client.disabledTools || []));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    apiFetch(`/api/mcp/clients/${encodeURIComponent(client.id)}/tools`)
      .then((r) => r.json())
      .then((data) => {
        setTools(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load tools");
        setLoading(false);
      });
  }, [client.id]);

  // Auto-expand all groups when user types — collapsed groups would hide matches
  useEffect(() => {
    if (search) setCollapsed({});
  }, [search]);

  function toggle(name) {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await apiFetch(`/api/mcp/clients/${encodeURIComponent(client.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disabledTools: [...disabled] }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const filtered = tools.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(search.toLowerCase()),
  );

  const grouped = filtered.reduce((acc, t) => {
    const g = getGroup(t.name);
    (acc[g] = acc[g] || []).push(t);
    return acc;
  }, {});
  const groupNames = Object.keys(grouped).sort();

  // Only use grouped view for large servers (Google Workspace etc.)
  const useGroups = tools.length > 10;

  // Count against visible tool names to avoid negative counts from stale disabledTools
  const disabledVisibleCount = tools.filter((t) => disabled.has(t.name)).length;
  const enabledCount = tools.length - disabledVisibleCount;

  function groupAllEnabled(group) {
    return grouped[group].every((t) => !disabled.has(t.name));
  }

  function toggleGroup(group) {
    setDisabled((prev) => {
      const next = new Set(prev);
      const allOn = grouped[group].every((t) => !next.has(t.name));
      grouped[group].forEach((t) =>
        allOn ? next.add(t.name) : next.delete(t.name),
      );
      return next;
    });
  }

  const toolRow = (t) => (
    <label
      key={t.name}
      className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-700/30 cursor-pointer group"
    >
      <input
        type="checkbox"
        checked={!disabled.has(t.name)}
        onChange={() => toggle(t.name)}
        className="mt-0.5 shrink-0 accent-indigo-500"
      />
      <div className="min-w-0">
        <p className="text-xs font-mono text-slate-200 group-hover:text-white">
          {t.name}
        </p>
        {t.description && (
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
            {t.description}
          </p>
        )}
      </div>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-xl border border-slate-700/50 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              {client.name} — Tools
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {enabledCount} of {tools.length} enabled
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-lg leading-none px-1"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-3 space-y-1">
          {loading && (
            <p className="text-center text-slate-400 text-sm py-6">
              Loading tools…
            </p>
          )}
          {error && (
            <p className="text-center text-red-400 text-sm py-6">{error}</p>
          )}
          {!loading && !error && tools.length === 0 && (
            <p className="text-center text-slate-500 text-sm py-6">
              No tools found
            </p>
          )}
          {!loading && !error && tools.length > 0 && (
            <>
              <input
                type="text"
                placeholder="Search tools…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 mb-2"
              />
              {filtered.length === 0 && (
                <p className="text-center text-slate-500 text-sm py-4">
                  No tools match &quot;{search}&quot;
                </p>
              )}
              {useGroups
                ? groupNames.map((g) => (
                    <div key={g} className="space-y-0.5">
                      <div
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/40 cursor-pointer select-none"
                        onClick={() =>
                          setCollapsed((p) => ({ ...p, [g]: !p[g] }))
                        }
                      >
                        <input
                          type="checkbox"
                          checked={groupAllEnabled(g)}
                          onChange={() => toggleGroup(g)}
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 accent-indigo-500"
                        />
                        <span className="text-xs font-semibold text-slate-300 flex-1">
                          {g}
                        </span>
                        <span className="text-xs text-slate-500">
                          {grouped[g].length}
                        </span>
                        <span className="text-slate-500 text-xs">
                          {collapsed[g] ? "▶" : "▼"}
                        </span>
                      </div>
                      {!collapsed[g] && (
                        <div className="pl-4 space-y-0.5">
                          {grouped[g].map(toolRow)}
                        </div>
                      )}
                    </div>
                  ))
                : filtered.map(toolRow)}
            </>
          )}
        </div>

        <div className="flex gap-2 justify-between items-center px-4 py-3 border-t border-slate-700/40">
          <div className="flex gap-2">
            <button
              onClick={() => setDisabled(new Set())}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700/40"
            >
              Enable all
            </button>
            <button
              onClick={() => setDisabled(new Set(tools.map((t) => t.name)))}
              className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-700/40"
            >
              Disable all
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-neon text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServerModal({ mode, client, onSaved, onClose }) {
  const isEdit = mode === "edit";
  const [name, setName] = useState("");
  const [transport, setTransport] = useState("stdio");
  const [command, setCommand] = useState("");
  const [args, setArgs] = useState("");
  const [envVars, setEnvVars] = useState("");
  const [clearEnv, setClearEnv] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (isEdit && client) {
      setName(client.name || "");
      setTransport(client.transport || "stdio");
      setCommand(
        client.transport === "stdio" ? client.command || "" : client.url || "",
      );
      setArgs((client.args || []).join("\n"));
      setEnvVars("");
      setClearEnv(false);
      setAutoConnect(client.autoConnect !== false);
    }
  }, [isEdit, client]);

  function buildTransportPayload() {
    const isRemote = transport === "http" || transport === "sse";
    return {
      transport,
      command: transport === "stdio" ? command : undefined,
      url: isRemote ? command : undefined,
      args: args
        ? args
            .split("\n")
            .flatMap((a) => (a.trim() ? a.trim().split(/\s+/) : []))
        : [],
    };
  }

  /** Body for test-connection (always send env when user typed lines). */
  function buildTestBody() {
    const base = { ...buildTransportPayload() };
    if (transport === "stdio" && envVars.trim()) {
      base.env = parseEnvLines(envVars);
    }
    return base;
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await apiFetch("/api/mcp/clients/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildTestBody()),
      });
      const data = await res.json();
      setTestResult(
        data.success
          ? { ok: true, tools: data.tools }
          : { ok: false, error: data.error },
      );
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    }
    setTesting(false);
  }

  async function handleSave() {
    if (!name.trim() || !command.trim()) {
      setTestResult({ ok: false, error: "Name and command/URL are required" });
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

        const res = await apiFetch(
          `/api/mcp/clients/${encodeURIComponent(client.id)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setTestResult({
            ok: false,
            error: data.error || `Update failed (${res.status})`,
          });
          return;
        }
        if (data.connectError) {
          setTestResult({
            ok: false,
            error: `Saved, but could not connect: ${data.connectError}\n\n${MCP_APP_LOG_HINT}`,
          });
          onSaved();
          return;
        }
      } else {
        const id = name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        const res = await apiFetch("/api/mcp/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
          setTestResult({ ok: false, error: data.error || "Failed to save" });
          return;
        }
        if (data.connectError) {
          setTestResult({
            ok: false,
            error: `Saved, but could not connect: ${data.connectError}\n\n${MCP_APP_LOG_HINT}`,
          });
          onSaved();
          return;
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setTestResult({ ok: false, error: err.message });
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-heavy rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 neon-border"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-100 neon-text mb-4">
          {isEdit ? "Edit MCP Server" : "Add MCP Server"}
        </h3>

        {isEdit && client && (
          <p className="text-xs text-slate-500 mb-3 font-mono">
            ID: <span className="text-slate-400">{client.id}</span> (fixed)
          </p>
        )}

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">
              Server Name
            </label>
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
            <label
              htmlFor="mcp-auto-connect"
              className="text-sm text-slate-300"
            >
              Connect automatically after saving
            </label>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-1 font-medium">
              Transport Type
            </label>
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
            <label className="block text-sm text-slate-300 mb-1 font-medium">
              {transport === "stdio" ? "Command" : "URL"}
            </label>
            <input
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder={
                transport === "stdio"
                  ? "node server.js"
                  : transport === "sse"
                    ? "http://localhost:8054/sse"
                    : "http://localhost:3001/mcp"
              }
              className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-sm"
            />
          </div>

          {transport === "stdio" && (
            <>
              <div>
                <label className="block text-sm text-slate-300 mb-1 font-medium">
                  Arguments (one per line)
                </label>
                <textarea
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  placeholder={"--debug\n--port 3001"}
                  className="w-full input-glow text-slate-100 rounded-lg px-3 py-2 outline-none font-mono text-sm"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1 font-medium">
                  Environment Variables (KEY=VALUE)
                </label>
                {isEdit && (
                  <p className="text-xs text-slate-500 mb-1">
                    Leave blank to keep saved values. Enter new lines to replace
                    all env vars for this server.
                  </p>
                )}
                <textarea
                  value={envVars}
                  onChange={(e) => {
                    setEnvVars(e.target.value);
                    if (e.target.value.trim()) setClearEnv(false);
                  }}
                  placeholder={"DEBUG=true\nPORT=3001"}
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
                        if (e.target.checked) setEnvVars("");
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
                ? "bg-green-500/10 border border-green-500/30 text-green-400"
                : "bg-red-500/10 border border-red-500/30 text-red-400"
            }`}
          >
            {testResult.ok ? (
              `Connection successful! Found ${testResult.tools?.length || 0} tools.`
            ) : (
              <div className="whitespace-pre-wrap break-words">
                <span className="font-semibold">Error:</span> {testResult.error}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end flex-wrap">
          <button
            onClick={handleTest}
            disabled={testing || !command.trim()}
            className="px-3 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {testing ? "..." : "Test"}
          </button>
          <button
            onClick={onClose}
            className="px-3 py-2 glass hover:bg-slate-600/30 text-slate-300 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-2 btn-neon text-white rounded-lg text-sm font-medium"
          >
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
  const [connectBanner, setConnectBanner] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [toolsModalClient, setToolsModalClient] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await apiFetch("/api/mcp/clients");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : data.code === "LOCAL_OR_API_KEY_REQUIRED"
              ? "This request was blocked (use http://127.0.0.1 or set VITE_CC_API_KEY to match server CC_API_SECRET)."
              : `Could not load MCP clients (HTTP ${res.status}).`;
        setFetchError(msg);
        setClients([]);
        setLoading(false);
        return;
      }
      setClients(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch clients:", err);
      setFetchError(err.message || "Network error");
      setClients([]);
    }
    setLoading(false);
  }

  async function handleConnect(id) {
    setConnectBanner(null);
    try {
      const res = await apiFetch(
        `/api/mcp/clients/${encodeURIComponent(id)}/connect`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const head =
          typeof data.error === "string"
            ? data.error
            : `Connect failed (HTTP ${res.status}).`;
        setConnectBanner({
          type: "error",
          text: `${head}\n\n${MCP_APP_LOG_HINT}`,
        });
        return;
      }
      await fetchClients();
    } catch (err) {
      const head = err.message || "Network error while connecting.";
      setConnectBanner({
        type: "error",
        text: `${head}\n\n${MCP_APP_LOG_HINT}`,
      });
    }
  }

  async function handleDisconnect(id) {
    try {
      await apiFetch(`/api/mcp/clients/${encodeURIComponent(id)}/disconnect`, {
        method: "POST",
      });
      fetchClients();
    } catch (err) {
      console.error("Failed to disconnect:", err);
    }
  }

  async function handleRemove(id) {
    if (confirm("Remove this server connection?")) {
      try {
        await apiFetch(`/api/mcp/clients/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        fetchClients();
      } catch (err) {
        console.error("Failed to remove:", err);
      }
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-slate-400">Loading servers...</div>
    );
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
      {connectBanner && (
        <div
          className={`p-3 rounded-lg border text-xs leading-relaxed flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${
            connectBanner.type === "error"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}
          role="status"
        >
          <span className="whitespace-pre-wrap break-words">
            {connectBanner.text}
          </span>
          <button
            type="button"
            onClick={() => setConnectBanner(null)}
            className="shrink-0 px-2.5 py-1 rounded-md border border-slate-500/50 hover:bg-slate-500/20 text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">
            External MCP Servers
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl">
            Chat only lists tools from servers that show{" "}
            <span className="text-slate-400">Connected</span>. Use{" "}
            <span className="text-slate-400">
              Connect automatically after saving
            </span>{" "}
            or click <span className="text-slate-400">Connect</span> after
            changes. If connect fails, use the banner or modal text plus{" "}
            <span className="font-mono text-slate-400">logs/app.log</span>{" "}
            (search{" "}
            <span className="font-mono text-slate-400">MCP connect failed</span>
            ).
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-neon text-white rounded-lg px-3 py-1.5 text-xs font-medium shrink-0"
        >
          + Add Server
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="p-8 text-center text-slate-400 glass rounded-lg border border-slate-700/30">
          <p className="text-sm mb-3">No external MCP servers configured</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-neon text-white rounded-lg px-4 py-2 text-sm font-medium"
          >
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
                    <StatusDot status={client.status || "disconnected"} />
                    <h4 className="font-medium text-slate-200">
                      {client.name}
                    </h4>
                    <span className="text-xs bg-slate-700/50 text-slate-300 px-2 py-0.5 rounded">
                      {transportLabel(client.transport)}
                    </span>
                    {client.autoConnect === false && (
                      <span
                        className="text-xs text-slate-500"
                        title="Does not auto-connect on startup"
                      >
                        manual
                      </span>
                    )}
                    {client.toolCount > 0 && (
                      <span className="text-xs text-slate-500">
                        {client.disabledTools?.length > 0
                          ? `${client.toolCount - client.disabledTools.length}/${client.toolCount} tools`
                          : `${client.toolCount} tools`}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-mono break-all">
                    {client.transport === "stdio" ? client.command : client.url}
                  </p>
                  {client.error && (
                    <p className="text-xs text-red-400 mt-1">{client.error}</p>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {client.status === "connected" ? (
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
                {client.status === "connected" && client.toolCount > 0 && (
                  <button
                    onClick={() => setToolsModalClient(client)}
                    className="text-xs px-2.5 py-1 rounded-lg text-slate-400 hover:text-violet-300 hover:bg-violet-500/10 transition-colors"
                  >
                    Tools
                  </button>
                )}
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
        <ServerModal
          mode="add"
          onSaved={fetchClients}
          onClose={() => setShowAddModal(false)}
        />
      )}
      {editingClient && (
        <ServerModal
          mode="edit"
          client={editingClient}
          onSaved={fetchClients}
          onClose={() => setEditingClient(null)}
        />
      )}
      {toolsModalClient && (
        <ToolsModal
          client={toolsModalClient}
          onSaved={fetchClients}
          onClose={() => setToolsModalClient(null)}
        />
      )}
    </div>
  );
}
