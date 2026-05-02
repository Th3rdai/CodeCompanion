# Crawl4AI RAG MCP (local Docker)

This document describes how to run the **Crawl4AI RAG** MCP server from a separate checkout (for example **`/Users/james/Projects/mcp_crawl4ai_rag`**) and connect it to Code Companion.

## What runs where

| Service              | Role                       | Host bind (default compose) |
| -------------------- | -------------------------- | --------------------------- |
| **mcp-crawl4ai-rag** | MCP over **SSE**, Crawl4AI | `http://127.0.0.1:8054`     |
| **postgres**         | Vector / app DB            | Internal only               |
| **postgrest**        | REST API over Postgres     | `http://127.0.0.1:3000`     |
| **neo4j**            | Optional knowledge graph   | Browser `7475`, Bolt `7688` |

The MCP app exposes **`GET /health`**, **`GET /sse`**, and the MCP message path used by the SDK (see the upstream repo **`docs/MCP_CONNECTION_GUIDE.md`**).

## Prerequisites

- Docker (or Docker Desktop) with enough RAM (compose reserves up to ~4G for the MCP container).
- A **`.env`** file in the Crawl4AI RAG repo (copy from **`.env.example`**). You need at least **OpenAI** (embeddings / model) or whatever that fork expects for RAG; **Postgres** credentials in **`.env`** must match **`POSTGRES_*`** used by **`docker-compose.yml`** — PostgREST is wired with **`PGRST_DB_URI=postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`**.

Initialize the DB schema from the repo’s **`crawled_pages.sql`** (mounted into Postgres on first start).

## Start the stack

```bash
cd /path/to/mcp_crawl4ai_rag
docker compose up -d
curl -sS http://127.0.0.1:8054/health
```

## Code Companion: `mcpClients` entry

In **`.cc-config.json`**, add (or merge) this object inside **`mcpClients`**:

```json
{
  "id": "crawl4ai-rag",
  "name": "Crawl4AI RAG",
  "transport": "sse",
  "command": "",
  "args": [],
  "env": {},
  "url": "http://127.0.0.1:8054/sse",
  "autoConnect": true,
  "disabledTools": []
}
```

- **`transport`** must be **`sse`** (this server uses FastMCP **`sse_app()`**, not streamable HTTP on `/mcp`).
- **`url`** must be the **full SSE URL**, including **`/sse`**.
- Prefer **`127.0.0.1`** instead of **`localhost`** for fewer resolver / IPv6 issues with Node MCP transports.

Then open **Settings → MCP Clients**, save if needed, and ensure the client shows **Connected** (or enable **Connect automatically**). On failures, see **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** (`MCP connect failed` in **`logs/app.log`**).

## Related

- Upstream connection details: **`docs/MCP_CONNECTION_GUIDE.md`** and **`docs/SETUP.md`** in the **`mcp_crawl4ai_rag`** repo.
- General MCP + config file locations: **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** (MCP section), **[CC-CONFIG.md](./CC-CONFIG.md)**.
