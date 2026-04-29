# MCPFIXPLAN: Per-Tool MCP Controls

## Plan Review Verdict: READY TO IMPLEMENT

Reviewed again against the current codebase. The plan is ready after correcting the test constructor pattern, adding API-route hardening for disabled-tools-only saves, and avoiding dependence on exact line numbers that may drift during implementation.

---

## Issues Found

### Major And Minor (incorporated into plan below)

- **Original unit test snippet used the wrong `ToolCallHandler` constructor shape.**
  Current constructor is `new ToolCallHandler(mcpClientManager, { log, debug, getConfig })`.
  Tests below now match the existing `tests/unit/tool-call-handler.test.js` pattern.

- **Disabled-tools-only client updates currently disconnect the active MCP client.**
  `PUT /api/mcp/clients/:id` disconnects before validation/save. The plan now includes route hardening so toggling tools does not disconnect Google MCP.

- **SERVICE_LABELS missing `calendars` key** (plural).
  `list_calendars` splits to `["list", "calendars"]` → lookup key is `"calendars"`, not `"calendar"`.
  Both singular and plural are needed. Fixed in Step 4's SERVICE_LABELS map.

- **Search should auto-expand collapsed groups.**
  When user types in search, any collapsed group that contains matches would be invisible.
  Fix: `useEffect` on `search` resets `collapsed` to `{}`. Incorporated in Step 4.

---

## Verified Code State

| Symbol                         | File                                   | Status                                                                  |
| ------------------------------ | -------------------------------------- | ----------------------------------------------------------------------- |
| `ToolCallHandler` constructor  | `lib/tool-call-handler.js`             | confirmed: `(mcpClientManager, { log, debug, getConfig } = {})`         |
| `executeTool()`                | `lib/tool-call-handler.js`             | confirmed                                                               |
| MCP `callTool` dispatch        | `lib/tool-call-handler.js`             | confirmed: no disabled-tools guard                                      |
| `this.getConfig()` pattern     | `lib/tool-call-handler.js`             | confirmed: already used in builtin path                                 |
| `PUT /mcp/clients/:id`         | `lib/mcp-api-routes.js`                | confirmed: disconnects before validation/save                           |
| `validateAndNormalizeConfig()` | `lib/mcp-client-manager.js`            | confirmed: accepts `disabledTools` arrays but does not sanitize entries |
| `ToolsModal`                   | `src/components/McpClientPanel.jsx`    | confirmed                                                               |
| Flat `tools.map()` render      | `src/components/McpClientPanel.jsx`    | confirmed                                                               |
| Footer Enable/Disable all      | `src/components/McpClientPanel.jsx`    | keep unchanged                                                          |
| Existing executeTool tests     | `tests/unit/tool-call-handler.test.js` | confirmed: no disabled-tool test                                        |

---

## Current Implementation Findings

Monitoring checkpoint: 2026-04-25 10:20 PT.

Claude has started implementation. The current working tree shows changes in:

- `lib/tool-call-handler.js`
- `lib/mcp-api-routes.js`
- `lib/mcp-client-manager.js`
- `src/components/McpClientPanel.jsx`
- `tests/unit/tool-call-handler.test.js`

### Completed Or Directionally Correct

- `lib/tool-call-handler.js` now has an execution-time disabled-tool guard before external MCP dispatch.
- The guard logs only `serverId` and `toolName`, not tool args.
- `tests/unit/tool-call-handler.test.js` now includes execution guard tests.
- Focused test command passed:

```bash
node --test tests/unit/tool-call-handler.test.js
```

Result observed: 19/19 passing.

- `lib/mcp-client-manager.js#validateAndNormalizeConfig()` now trims, de-duplicates, drops empty disabled tool names, and rejects non-string disabled tool entries.
- `lib/mcp-api-routes.js#PUT /mcp/clients/:id` now validates before disconnecting.
- `PUT /mcp/clients/:id` now skips disconnect when the only update key is `disabledTools`.
- `src/components/McpClientPanel.jsx` now includes most modal UX improvements:
  - `SERVICE_LABELS`
  - `getGroup()`
  - search by name/description
  - grouped view for large servers
  - group checkbox toggles
  - auto-expand groups while searching
  - `max-w-2xl`
  - modal count calculation based on visible tool names

### Remaining Gaps Before Review/Done

- The client card button still renders `Tools`; change it to `Manage Tools`.
- The client card tool count still uses `client.toolCount - client.disabledTools.length`, which can undercount if stale disabled tool names exist. Either reuse the stale-safe count when possible or accept that only the modal count is stale-safe and document the card as a known limitation.
- Add tests for `disabledTools` normalization in `tests/mcp-security.test.js` or another existing MCP manager test file.
- Add route/helper tests proving disabled-tools-only saves do not call `disconnect()`.
- Add route/helper tests proving invalid client updates do not call `disconnect()`.
- Run `npm run test:unit` after all focused tests are in place.
- Run manual Google MCP verification only after implementation and tests are stable.

Do not mark the route hardening or focused tests tasks as review until the no-disconnect and normalization tests exist or the absence of a practical route test harness is explicitly documented with a helper-level substitute.

---

## Step 1 — Execution-Time Denial (Gap 2)

**File:** `lib/tool-call-handler.js`

Insert after the closing `}` of the builtin block and before the existing MCP dispatch comment:

```js
// Block disabled MCP tools at execution time. Prompt filtering alone is not enforcement.
const config = this.getConfig();
const clientConfig = (config.mcpClients || []).find((c) => c.id === serverId);
const disabledTools = Array.isArray(clientConfig?.disabledTools)
  ? clientConfig.disabledTools
  : [];
if (disabledTools.includes(toolName)) {
  this.log("WARN", "Blocked disabled MCP tool call", {
    serverId,
    toolName,
  });
  return {
    success: false,
    error: `Tool ${serverId}.${toolName} is disabled in Settings -> MCP Clients. Enable it before retrying.`,
  };
}
```

After the edit, that section should read:

```js
    }

    // Block disabled MCP tools at execution time. Prompt filtering alone is not enforcement.
    const config = this.getConfig();
    const clientConfig = (config.mcpClients || []).find((c) => c.id === serverId);
    const disabledTools = Array.isArray(clientConfig?.disabledTools)
      ? clientConfig.disabledTools
      : [];
    if (disabledTools.includes(toolName)) {
      this.log("WARN", "Blocked disabled MCP tool call", {
        serverId,
        toolName,
      });
      return {
        success: false,
        error: `Tool ${serverId}.${toolName} is disabled in Settings -> MCP Clients. Enable it before retrying.`,
      };
    }

    // Existing MCP dispatch (bounded — hung tools were stalling the whole chat)
    try {
      const result = await withTimeout(
        this.mcpClient.callTool(serverId, toolName, args),
        MCP_TOOL_TIMEOUT_MS,
        `MCP ${serverId}.${toolName}`,
      );
      return { success: true, result };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
```

---

## Step 2 — Unit Tests for Execution-Time Denial

**File:** `tests/unit/tool-call-handler.test.js`

Check the existing constructor pattern in `tests/unit/tool-call-handler.test.js` and match it exactly. Add these tests after the existing `executeTool` timeout/success tests:

```js
test("executeTool MCP blocks disabled external tool before callTool", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  let called = false;
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => {
      called = true;
      return { content: [] };
    },
  };
  const h = new ToolCallHandler(mockMcp, {
    getConfig: () => ({
      mcpClients: [
        { id: "google-workspace", disabledTools: ["send_gmail_message"] },
      ],
    }),
    log: () => {},
  });

  const result = await h.executeTool(
    "google-workspace",
    "send_gmail_message",
    {},
  );

  assert.strictEqual(result.success, false);
  assert.match(result.error, /google-workspace\.send_gmail_message.*disabled/i);
  assert.strictEqual(called, false, "disabled tool must not call MCP server");
});

test("executeTool MCP allows enabled external tool", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  let called = false;
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => {
      called = true;
      return { content: [{ type: "text", text: "ok" }] };
    },
  };
  const h = new ToolCallHandler(mockMcp, {
    getConfig: () => ({
      mcpClients: [
        { id: "google-workspace", disabledTools: ["send_gmail_message"] },
      ],
    }),
    log: () => {},
  });

  const result = await h.executeTool(
    "google-workspace",
    "search_gmail_messages",
    {},
  );

  assert.strictEqual(result.success, true);
  assert.strictEqual(called, true);
});

test("executeTool MCP allows server with no disabledTools entry", async () => {
  const ToolCallHandler = loadHandlerWithMcpTimeoutMs(5000);
  let called = false;
  const mockMcp = {
    getAllTools: () => [],
    callTool: async () => {
      called = true;
      return { content: [] };
    },
  };
  const h = new ToolCallHandler(mockMcp, {
    getConfig: () => ({
      mcpClients: [
        { id: "google-workspace", disabledTools: ["send_gmail_message"] },
      ],
    }),
    log: () => {},
  });

  const result = await h.executeTool("other-server", "any_tool", {});

  assert.strictEqual(result.success, true);
  assert.strictEqual(called, true);
});
```

Run after adding:

```bash
node --test tests/unit/tool-call-handler.test.js
```

---

## Step 3 — Client Update Route Hardening

**Files:** `lib/mcp-api-routes.js`, `lib/mcp-client-manager.js`

The existing `PUT /api/mcp/clients/:id` route disconnects the client before validation and before knowing whether the update only changes `disabledTools`. Fix this before relying on the Settings workflow.

### Required behavior

- A disabled-tools-only update must persist `disabledTools` without disconnecting the active MCP client.
- An invalid update must not disconnect a currently working MCP client.
- Transport-affecting updates can keep the existing disconnect behavior.
- `disabledTools` should be normalized to clean tool-name strings.

### Implementation guidance

1. In `validateAndNormalizeConfig()`, normalize `disabledTools`:

```js
if (!Array.isArray(serverConfig.disabledTools)) {
  normalized.disabledTools = [];
} else {
  normalized.disabledTools = [
    ...new Set(
      serverConfig.disabledTools
        .map((name) => {
          if (typeof name !== "string") {
            throw new Error(
              "Invalid MCP client config: disabledTools entries must be strings",
            );
          }
          return name.trim();
        })
        .filter(Boolean),
    ),
  ];
}
```

2. In `PUT /mcp/clients/:id`, validate the merged config before disconnecting:

```js
const updates = { ...req.body };
delete updates.id;
const merged = { ...clients[idx], ...updates };
let validated;
try {
  validated = mcpClientManager.validateAndNormalizeConfig(merged);
} catch (err) {
  // return existing 400/500 response without disconnecting
}
```

3. Detect disabled-tools-only updates:

```js
const updateKeys = Object.keys(updates);
const disabledToolsOnly =
  updateKeys.length === 1 && updateKeys[0] === "disabledTools";
```

4. Save without disconnecting when `disabledToolsOnly` is true:

```js
clients[idx] = validated;
updateConfig({ mcpClients: clients });
return res.json({ ...clients[idx], env: maskEnvVars(clients[idx].env) });
```

5. Only call `mcpClientManager.disconnect(req.params.id)` for updates that can affect the running transport or client identity.

### Tests

Add or update route/helper coverage to prove:

- disabled-tools-only save calls `updateConfig` and does not call `disconnect`
- invalid update returns validation error and does not call `disconnect`
- `validateAndNormalizeConfig()` trims, de-duplicates, and rejects non-string disabled tool names

---

## Step 4 — ToolsModal UX (Gap 1)

**File:** `src/components/McpClientPanel.jsx`

Replace the entire current `ToolsModal` function with the following.
Also add `SERVICE_LABELS` and `getGroup` as module-level declarations above `ToolsModal`
(they are not inside the function).

### Module-level additions (insert immediately before `ToolsModal`):

```js
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
```

### Replacement ToolsModal:

```jsx
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
```

**Notes:**

- `SERVICE_LABELS` and `getGroup` go at module level, immediately before `ToolsModal`.
- `useGroups = tools.length > 10` keeps flat rendering for small servers.
- `Enable all` / `Disable all` operate on the full `tools` array (not `filtered`).
- `enabledCount` is now computed from visible tool names only, avoiding stale-name undercount.

---

## Execution Order

1. **Step 1** — Edit `lib/tool-call-handler.js` (insert the execution guard before external MCP dispatch)
2. **Step 2** — Add unit tests to `tests/unit/tool-call-handler.test.js`
3. Run `node --test tests/unit/tool-call-handler.test.js` — all must pass
4. **Step 3** — Harden `PUT /api/mcp/clients/:id` so disabled-tools-only saves do not disconnect
5. Add focused route/helper tests for disabled-tools-only saves and invalid updates
6. **Step 4** — Replace `ToolsModal` in `src/components/McpClientPanel.jsx`
7. Run `npm run test:unit` — all unit tests must pass
8. Manual smoke test:
   - Open Settings -> MCP Clients -> Google Workspace -> Manage Tools
   - Search filters in real time; groups collapse/expand
   - Group checkbox enables/disables all tools atomically
   - Modal is visibly wider (`max-w-2xl`)
   - Disable `send_gmail_message`, save, confirm Google MCP remains connected
   - Restart and confirm `send_gmail_message` is still disabled
   - In agentic mode prompt model to call a disabled tool and confirm error appears in chat

---

## Acceptance Criteria

- [ ] Client card button says `Manage Tools`, not `Tools`
- [ ] Search input filters by name + description in real time
- [ ] Tools grouped by service; groups collapsible
- [ ] Group checkbox enables/disables all tools in that group
- [ ] Modal is `max-w-2xl`
- [ ] `Enable all` / `Disable all` apply to full (unfiltered) list
- [ ] Disabled tool blocked at execution time with clear error message
- [ ] Disabled-tools-only saves do not disconnect the active MCP client
- [ ] Invalid client updates do not disconnect an active MCP client
- [ ] `disabledTools` is normalized to clean, unique strings
- [ ] Tests cover `disabledTools` normalization
- [ ] Tests cover disabled-tools-only save no-disconnect behavior
- [ ] Tests cover invalid update no-disconnect behavior
- [ ] `disabledTools` persists across restarts
- [ ] Small servers (≤10 tools) render flat list without grouping
- [ ] Unit tests pass

---

## Security Notes

- The execution guard logs only `serverId` and `toolName` — never logs args.
- Prompt filtering is advisory; execution guard is the enforcement layer.
- `Enable all` / `Disable all` are intentionally broad — user must confirm via Save.

---

## Plan-Reviewer Self-Check

- Verdict remains **READY TO IMPLEMENT** after revision.
- All referenced files and APIs were re-checked against current code.
- The plan now covers both safety layers: prompt filtering and execution denial.
- The plan now covers the Settings save path so tool toggles do not disconnect active MCP clients.
- Test snippets match the actual `ToolCallHandler` constructor and `node:test` style used in the repo.
- Remaining implementation judgment: if route tests are awkward, extract a small pure helper for classifying disabled-tools-only updates and unit test that helper plus `validateAndNormalizeConfig()`.
