# MCP Client Tools Modal — Upgrade Tracker

## Context

Code Companion v1.6.9 added per-tool enable/disable for MCP clients via a
`ToolsModal` in `src/components/McpClientPanel.jsx` (lines 36–176).

The immediate driver is the **Google Workspace MCP** (Docker, `localhost:8889`),
which exposes **121 tools** across 12 services. It is authenticated as
`agentz@th3rdai.com` and `autoConnect: true` in `.cc-config.json`.

The modal exists and saves correctly, but two gaps need to close:

1. **UX gap** — flat 121-item list is unusable; needs search + service grouping.
2. **Safety gap** — disabled tools are filtered from the prompt but NOT blocked
   at execution time; a model that somehow emits a disabled tool will execute it.

---

## What Already Works (do not re-implement)

| Piece                                                       | File                                       | Status    |
| ----------------------------------------------------------- | ------------------------------------------ | --------- |
| `ToolsModal` — checkbox list, save, cancel                  | `src/components/McpClientPanel.jsx:36–176` | ✓ Working |
| `GET /api/mcp/clients/:id/tools`                            | `lib/mcp-api-routes.js`                    | ✓ Working |
| `PUT /api/mcp/clients/:id` saves `disabledTools`            | `lib/mcp-api-routes.js`                    | ✓ Working |
| `disabledTools` persisted in `.cc-config.json`              | `lib/mcp-client-manager.js:293`            | ✓ Working |
| Advertisement filtering via `getAllTools(disabledToolsMap)` | `lib/mcp-client-manager.js:231`            | ✓ Working |
| `disabledToolsMap` built in `getToolsPromptAndFlags()`      | `lib/tool-call-handler.js:364–370`         | ✓ Working |
| Enable all / Disable all footer buttons                     | `McpClientPanel.jsx:146–157`               | ✓ Working |

---

## Gap 1 — UX: Search + Service Grouping

**File:** `src/components/McpClientPanel.jsx`, `ToolsModal` (lines 36–176)

### 1a — Search / filter input

Add a `search` state. Filter `tools` before rendering.

```js
const [search, setSearch] = useState("");
const filtered = tools.filter(
  (t) =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    (t.description || "").toLowerCase().includes(search.toLowerCase()),
);
```

Render a search input above the list (inside the scrollable area header):

```jsx
<input
  type="text"
  placeholder="Search tools…"
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="w-full px-3 py-1.5 text-xs rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 mb-2"
/>
```

### 1b — Group tools by service

Google Workspace tools follow `{verb}_{service}_{noun}` naming. Extract the
**second underscore-delimited segment** as the group key.

```js
const SERVICE_LABELS = {
  gmail: "Gmail",
  drive: "Drive",
  calendar: "Calendar",
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

Build grouped structure from `filtered`:

```js
const grouped = filtered.reduce((acc, t) => {
  const g = getGroup(t.name);
  (acc[g] = acc[g] || []).push(t);
  return acc;
}, {});
const groupNames = Object.keys(grouped).sort();
```

### 1c — Group-level enable/disable + collapse

```js
const [collapsed, setCollapsed] = useState({});

function groupAllEnabled(group) {
  return grouped[group].every((t) => !disabled.has(t.name));
}

function toggleGroupEnabled(group) {
  setDisabled((prev) => {
    const next = new Set(prev);
    const allOn = grouped[group].every((t) => !next.has(t.name));
    grouped[group].forEach((t) =>
      allOn ? next.add(t.name) : next.delete(t.name),
    );
    return next;
  });
}
```

Group header (renders before each group's tool list):

```jsx
<div
  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/40 cursor-pointer select-none"
  onClick={() => setCollapsed((p) => ({ ...p, [g]: !p[g] }))}
>
  <input
    type="checkbox"
    checked={groupAllEnabled(g)}
    onChange={() => toggleGroupEnabled(g)}
    onClick={(e) => e.stopPropagation()}
    className="shrink-0 accent-indigo-500"
  />
  <span className="text-xs font-semibold text-slate-300 flex-1">{g}</span>
  <span className="text-xs text-slate-500">{grouped[g].length}</span>
  <span className="text-slate-500 text-xs">{collapsed[g] ? "▶" : "▼"}</span>
</div>
{!collapsed[g] && grouped[g].map((t) => /* existing tool row */)}
```

### 1d — Widen modal

Change `max-w-lg` → `max-w-2xl` on the modal container div (line 86).

### What does NOT change in the modal

- Footer save/cancel/Enable-all/Disable-all buttons — unchanged
- `Enable all` / `Disable all` apply to the **full** `tools` array, not just
  the filtered view
- API call shape — unchanged

---

## Gap 2 — Safety: Execution-Time Denial

**File:** `lib/tool-call-handler.js`, `executeTool()` (lines 309–355)

Currently the MCP dispatch path (line 344–351) calls `callTool` with no check:

```js
// CURRENT — no disabled-tools guard
const result = await withTimeout(
  this.mcpClient.callTool(serverId, toolName, args),
  MCP_TOOL_TIMEOUT_MS,
  `MCP ${serverId}.${toolName}`,
);
```

**Fix:** Before calling `callTool`, check whether the tool is disabled for
this server. The disabled list is available via `this.getConfig()`.

```js
// ADD before the withTimeout call:
const config = this.getConfig();
const clientCfg = (config.mcpClients || []).find((c) => c.id === serverId);
if (clientCfg?.disabledTools?.includes(toolName)) {
  return {
    success: false,
    error: `Tool ${serverId}.${toolName} is disabled in Settings → MCP Clients. Enable it before retrying.`,
  };
}
```

This is a defensive backstop — the prompt already won't include disabled
tools, but this blocks any edge case where a stale prompt or confused model
emits a disabled tool name anyway.

---

## Implementation Order

1. **Gap 2 first** (5 min, single-file, high safety value)
   - Edit `lib/tool-call-handler.js` `executeTool()` as above
   - Add/extend unit test in `tests/unit/tool-call-handler.test.js`

2. **Gap 1** (UI, ~30–45 min)
   - Edit `ToolsModal` in `src/components/McpClientPanel.jsx`
   - Add search, grouping, group-level toggle, widen modal
   - No backend changes needed

3. **Test**
   - Run `node --test tests/unit/tool-call-handler.test.js`
   - Run `npm run test:unit` (all 222 must pass)
   - Manually open Settings → MCP Clients → Google Workspace → Tools
   - Confirm search filters, groups collapse, group toggles work
   - Disable `send_gmail_message`, save, restart server, confirm still disabled
   - In agentic mode, prompt the model to send an email — confirm it errors

---

## Acceptance Criteria

- [ ] Search input filters tool list in real time (name + description)
- [ ] Tools grouped by service; groups are collapsible
- [ ] Group header checkbox enables/disables all tools in group atomically
- [ ] Modal is wider (`max-w-2xl`)
- [ ] `Enable all` / `Disable all` still apply to full (unfiltered) list
- [ ] Disabled tools blocked at execution time with a clear error message
- [ ] `disabledTools` persists across restarts (already works — verify only)
- [ ] No regressions for small servers (≤10 tools, no grouping needed)
- [ ] All 222 unit tests pass

---

## Suggested Test Prompt (post-implementation)

```
Use only google.search_gmail_messages. Do not call start_google_auth,
terminal tools, send, draft, or get message content.
Check agentz@th3rdai.com with query "in:inbox is:unread newer_than:1d"
and report only the count — no subjects, senders, snippets, IDs, or bodies.
```

Expected: one tool call, no others, final answer is a count.

---

## Google Workspace Tool Groups (for reference)

| Group               | Example tools                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Gmail (14)          | search_gmail_messages, send_gmail_message, draft_gmail_message, get_gmail_message_content |
| Drive (14)          | search_drive_files, get_drive_file_content, create_drive_file, manage_drive_access        |
| Docs (15)           | get_doc_content, create_doc, modify_doc_text, export_doc_to_pdf                           |
| Calendar (7)        | list_calendars, get_events, manage_event, query_freebusy                                  |
| Sheets (11)         | read_sheet_values, modify_sheet_values, create_spreadsheet, format_sheet_range            |
| Chat (6)            | list_spaces, get_messages, send_message, search_messages                                  |
| Forms (6)           | create_form, get_form, list_form_responses, batch_update_form                             |
| Slides (7)          | create_presentation, get_presentation, batch_update_presentation                          |
| Tasks (6)           | list_tasks, get_task, manage_task, list_task_lists                                        |
| Contacts (8)        | list_contacts, search_contacts, manage_contact, manage_contacts_batch                     |
| Apps Script (14)    | list_script_projects, run_script_function, manage_deployment, get_script_metrics          |
| Search / Custom (3) | search_custom, get_search_engine_info                                                     |
| Google Auth (1)     | start_google_auth                                                                         |
