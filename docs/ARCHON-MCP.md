# Archon MCP with Code Companion

If you run **Archon** via Docker (separate knowledge/task stack) with an HTTP MCP listener, Code Companion can use it as an external MCP server. Code Companion’s **MCP Clients** (streamable **HTTP**, with automatic **SSE** fallback) can attach to it.

## Default Archon URLs (Docker Compose)

| Service | URL                           |
| ------- | ----------------------------- |
| UI      | http://localhost:3737         |
| API     | http://localhost:8181         |
| **MCP** | **http://localhost:8051/mcp** |

Use **`127.0.0.1`** in config if you prefer to avoid IPv6 quirks.

### Archon on another machine (LAN)

If Docker runs on a different host (e.g. desktop at **`192.168.x.x`**) and Code Companion on your laptop, set **`url`** to **`http://<that-host>:8051/mcp`** instead of loopback. The repo **`.cc-config.json`** is set to **`127.0.0.1`** when Archon and the app share one machine; switch the host if your layout differs.

## `.cc-config.json` — `mcpClients` entry

Merge this object into the **`mcpClients`** array (or add the array if missing). **Restart** Code Companion after saving. (Putting API keys in **`mcpClients[].env`** is normal for some servers — keep **`.cc-config.json`** private; see **`docs/CC-CONFIG.md`**.)

```json
{
  "id": "archon",
  "name": "Archon",
  "transport": "http",
  "command": "",
  "args": [],
  "env": {},
  "url": "http://127.0.0.1:8051/mcp",
  "autoConnect": true,
  "disabledTools": []
}
```

- **`transport`:** `"http"` — Code Companion uses streamable HTTP; if the server returns **405 Method Not Allowed**, it retries as **SSE** on the same URL.
- **`autoConnect`:** `true` — connect when the app starts (disable if Archon is not always up).

If Archon requires headers (e.g. API keys), add them under **`env`** only if your Archon build documents supported keys for the MCP server; most local Docker setups need none.

## Settings UI

**Settings → MCP Clients → Add client**

- Transport: **HTTP**
- URL: `http://127.0.0.1:8051/mcp`
- Enable **Connect on startup** if you want `autoConnect` behavior.

## Verify from the repo

With Archon healthy on port **8051**:

```bash
node -e "
const M = require('./lib/mcp-client-manager.js');
const m = new M({ log: () => {}, debug: () => {} });
m.connect({ id: 'archon', name: 'Archon', transport: 'http', url: 'http://127.0.0.1:8051/mcp' })
  .then(t => { console.log('tools:', t.length); return m.disconnect('archon'); })
  .catch(e => { console.error(e.message); process.exit(1); });
"
```

Expect a non-zero tool count (e.g. **14** on a typical Archon MCP build).

## After editing config

1. **Restart** the Code Companion server or desktop app so **`autoConnect`** runs again.
2. **Settings → MCP Clients** — confirm **Archon** shows connected (or use **Connect** once).
3. In **Agentic** / tool-using chat, Archon tools should appear alongside other MCP servers.

## Related

- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** — where `.cc-config.json` lives (repo vs Electron **`CC_DATA_DIR`**).
- **[ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)** — LAN / **`X-CC-API-Key`** for sensitive MCP API routes.
