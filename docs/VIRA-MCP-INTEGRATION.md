# CodeCompanion MCP Integration with VIRA

**Status:** ✓ Integrated  
**Date:** 2026-06-28  
**Maintainer:** JARVIS (VIRA)

---

## Overview

CodeCompanion's MCP server (`mcp-server.js`) is registered with **VIRA** — a local voice-interactive agent with tool support and memory. VIRA calls CodeCompanion tools via the MCP protocol to integrate IDE automation, project building, testing, and analysis.

---

## VIRA Configuration

### Location

**File:** `~/.vira/config.yaml`

### MCP Server Entry

```yaml
mcp_servers:
  - name: codeCompanion
    command: node
    args:
      - /Users/james/Projects/CodeCompanion/mcp-server.js
    transport: stdio
```

**Critical:** Full absolute path (`/Users/james/Projects/CodeCompanion/mcp-server.js`) is required. VIRA uses this path regardless of working directory.

### Why Absolute Path?

- VIRA may run from any directory (web UI, CLI, scheduled tasks)
- Relative paths (e.g., `./mcp-server.js` or `$PWD/mcp-server.js`) fail when working directory changes
- Absolute path ensures consistent server startup

---

## How VIRA Calls CodeCompanion Tools

### 1. **Chat Integration**

User requests CodeCompanion actions in VIRA chat:

```
You: "Build the project with CodeCompanion"
VIRA: [loads codeCompanion tools via MCP]
      [calls buildProject tool]
      [returns result to user]
```

### 2. **Skill Integration**

VIRA harness skills invoke CodeCompanion tools:

- `/build` — Invoke build tools
- `/validate` — Run tests via CodeCompanion
- `/debug` — Analyze failures with CodeCompanion analyzers

### 3. **CLI Invocation**

```bash
vira mcp call codeCompanion <toolName> --input '{"param":"value"}'
```

### 4. **Scheduled Tasks**

VIRA task scheduler can run CodeCompanion tools on a schedule:

```bash
vira task create --skill codeCompanion/buildProject --recur daily
```

---

## Available Tools

CodeCompanion's MCP tools are loaded from `./mcp/tools/` directory. All tools are registered at startup.

### List Tools

```bash
# From VIRA web UI
Tools drawer → codeCompanion → [tool list]

# From CLI
vira mcp tools codeCompanion

# Direct query
vira mcp list-servers
```

---

## Setup Verification

### 1. Confirm VIRA Configuration

```bash
# Check config has codeCompanion entry
grep -A 3 "codeCompanion" ~/.vira/config.yaml
```

Expected:

```
- name: codeCompanion
  command: node
  args:
  - /Users/james/Projects/CodeCompanion/mcp-server.js
```

### 2. Verify CodeCompanion Files

```bash
# Check mcp-server.js exists and is valid Node.js
file /Users/james/Projects/CodeCompanion/mcp-server.js
node -c /Users/james/Projects/CodeCompanion/mcp-server.js  # syntax check

# Verify mcp/tools directory
ls -la /Users/james/Projects/CodeCompanion/mcp/tools/
```

### 3. Test Server Startup

```bash
# Start server directly (should not error)
timeout 3 node /Users/james/Projects/CodeCompanion/mcp-server.js 2>&1 || true

# Expected output: server initializes and waits for MCP messages
```

### 4. Restart VIRA

```bash
pkill vira  # stop if running
sleep 2
vira web    # start fresh
```

### 5. Check Connection Status

In VIRA chat or web UI:

```
Tools drawer → MCP Servers → codeCompanion
Status: Connected / Ready
```

---

## Troubleshooting

### Issue: "codeCompanion not found" or "disconnected"

**Check 1: File Path**

```bash
ls -la /Users/james/Projects/CodeCompanion/mcp-server.js
# Should exist and be readable
```

**Check 2: VIRA Config**

```bash
grep "codeCompanion" ~/.vira/config.yaml
# Should show ABSOLUTE path (starts with /)
```

**Check 3: Restart VIRA**

```bash
pkill vira
sleep 1
vira web
```

**Check 4: Logs**

```bash
tail -50 ~/.vira/logs/mcp-stderr.log
# Look for error messages or connection attempts
```

### Issue: "Tools list is empty"

**Cause:** `mcp/tools/` directory missing or empty

**Fix:**

```bash
# Verify directory exists
ls -la /Users/james/Projects/CodeCompanion/mcp/tools/

# Verify it has .js files
find /Users/james/Projects/CodeCompanion/mcp/tools/ -name "*.js" | head -5
```

If empty, reinstall CodeCompanion:

```bash
cd /Users/james/Projects/CodeCompanion
npm install
npm run build  # if needed
```

### Issue: Tools timeout or hang

**Check .env config:**

```bash
cat /Users/james/Projects/CodeCompanion/.env | head -20
```

**Missing credentials?** Tools may hang waiting for API responses. Verify all required API keys are present.

**Restart both:**

```bash
pkill node    # kill all Node processes
sleep 2
vira web      # restart VIRA
```

---

## Environment Configuration

CodeCompanion loads `.env` file at startup. If tools need external APIs or credentials:

**File:** `/Users/james/Projects/CodeCompanion/.env`

```bash
# Example (adjust for your setup)
NODE_ENV=production
LOG_LEVEL=info
BUILD_TIMEOUT=300
TEST_TIMEOUT=60
# Add API keys as needed
```

See `.env.example` for template.

---

## Integration Workflows

### Workflow 1: Build + Test via VIRA

```
User: "Build and test the project"
  ↓
VIRA: [calls codeCompanion/build tool]
  ↓
CodeCompanion: [compiles, runs tests]
  ↓
VIRA: [reports results to user]
```

### Workflow 2: Analyze Code Issues

```
User: "CodeCompanion, analyze this file"
  ↓
VIRA: [calls codeCompanion/analyze tool]
  ↓
CodeCompanion: [lints, checks patterns]
  ↓
VIRA: [displays findings]
```

### Workflow 3: Harness Validation

```
VIRA Harness /validate skill
  ↓
[runs CodeCompanion linters/tests]
  ↓
[returns pass/fail + coverage report]
```

---

## Best Practices

1. **Keep absolute paths** in `~/.vira/config.yaml` — never use relative or `$PWD` paths
2. **Restart VIRA after config changes** — MCP servers are loaded at startup
3. **Monitor logs for errors** — `~/.vira/logs/mcp-stderr.log` is your source of truth
4. **Set timeouts for long operations** — CodeCompanion tools may take time; adjust MCP request timeouts as needed
5. **Keep `.env` secrets private** — don't commit or share API keys

---

## Related Documentation

- **CodeCompanion Repo:** `/Users/james/Projects/CodeCompanion/`
- **CodeCompanion MCP Server:** `mcp-server.js` (root)
- **CodeCompanion MCP Tools:** `mcp/tools/` (registry)
- **VIRA Config:** `~/.vira/config.yaml`
- **VIRA Memory:** `~/.vira/memory_vault/Memory/CodeCompanion-MCP.md`
- **VIRA README:** `~/.vira/README.md`
- **Archon Integration:** `docs/ARCHON-MCP.md`

---

## Contact & Support

If issues persist:

1. Check all paths exist and are absolute
2. Verify Node.js is installed: `node --version`
3. Review VIRA logs: `tail -100 ~/.vira/logs/mcp-stderr.log`
4. Restart both VIRA and CodeCompanion cleanly
5. Consult CodeCompanion `docs/` for MCP tool details
