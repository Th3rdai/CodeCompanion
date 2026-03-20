# Docling Auto-Start Documentation

## Overview

Code Companion now automatically starts `docling-serve` when the web server starts, providing seamless document conversion capabilities without manual setup.

## How It Works

### 1. Server-Level Auto-Start (`server.js`)

When you start the web server with `node server.js`, it automatically:

1. Checks if docling-serve is installed
2. Checks if it's already running on port 5002
3. Starts it in the background if needed
4. Waits for it to become healthy (up to 30 seconds)
5. Shuts it down gracefully when the server stops

**Implementation:** `lib/docling-starter.js` + integration in `server.js`

### 2. Startup Script Auto-Start (`startup.sh`)

The enhanced startup script now includes docling-serve management:

```bash
./startup.sh
```

This provides:
- Clean shutdown of previous instances
- Health checks for docling-serve
- Status reporting in the startup summary
- Better error messages if docling is not installed

### 3. Quick Start Script (`start.sh`)

A new simplified start script:

```bash
./start.sh
```

This is the fastest way to get everything running:
- Starts docling-serve if not already running
- Builds frontend if needed
- Starts the web server
- Minimal output, quick startup

## Installation

### Install docling-serve

**Using uv (recommended):**
```bash
uv tool install "docling-serve[ui]"
```

**Using pip:**
```bash
pip install "docling-serve[ui]"
```

**Using pipx:**
```bash
pipx install "docling-serve[ui]"
```

### Verify Installation

```bash
which docling-serve
# Should show: /Users/yourname/.local/bin/docling-serve (or similar)

docling-serve --help
# Should show docling-serve help
```

## Configuration

In Settings (⚙️), configure the Docling section:

- **URL:** `http://127.0.0.1:5002` (default, recommended)
- **Enabled:** Toggle document conversion on/off
- **OCR:** Enable optical character recognition
- **OCR Engine:** `easyocr` (default) or `tesseract`
- **Max File Size:** Maximum document size in MB

## Port Configuration

**Default port:** 5002

**Why 5002?** Port 5001 conflicts with macOS AirPlay Receiver.

**Change the port:**
1. Update Settings → Docling → URL
2. Restart the server

## Auto-Start Behavior

### When Auto-Start Activates

✅ **Starts docling-serve when:**
- Docling is enabled in settings (default: true)
- Binary is found on the system
- Port 5002 is not already in use
- Not already running

⏭️ **Skips auto-start when:**
- Docling is disabled in settings
- Binary not found (shows install instructions)
- Already running on the target port
- Port conflict detected

### Startup Timing

- **Server startup:** Async, doesn't block the web server
- **Health check timeout:** 30 seconds
- **Model loading:** Can take 10-30 seconds on first start (EasyOCR models)

**Note:** The web server will start immediately even if docling-serve is still loading models in the background.

## Health Checks

### Manual Health Check

```bash
curl http://127.0.0.1:5002/health
# Response: {"status":"ok"}
```

### In-App Health Check

Settings → Docling → "Test Connection" button

### Logs

**Startup script logs:**
```bash
cat /tmp/docling-serve.log
```

**Server logs:**
Look for `[Docling]` prefix in server output

## Troubleshooting

### "docling-serve not found"

Install it:
```bash
uv tool install "docling-serve[ui]"
```

Verify:
```bash
which docling-serve
```

### "Port 5002 is in use"

Check what's using it:
```bash
lsof -i :5002
```

Kill the process:
```bash
lsof -ti:5002 | xargs kill
```

Or change the port in Settings.

### "Connection timed out (5s)" in Test Connection

This is normal during first startup — model loading can take 30+ seconds.

Wait a minute and try again:
```bash
curl http://127.0.0.1:5002/health
```

### Docling Process Won't Stop

Force kill:
```bash
pkill -9 -f docling-serve
```

### "fetch failed" Error

**Causes:**
1. Docling not running
2. Wrong URL in settings
3. Firewall blocking localhost connections

**Fix:**
```bash
# Check if running
curl http://127.0.0.1:5002/health

# Start manually
docling-serve run --host 127.0.0.1 --port 5002

# Check settings URL matches
```

## Manual Control

### Start Manually

```bash
docling-serve run --host 127.0.0.1 --port 5002
```

### Start in Background

```bash
nohup docling-serve run --host 127.0.0.1 --port 5002 > /tmp/docling-serve.log 2>&1 &
```

### Stop Docling

```bash
pkill -f docling-serve
```

### Check Status

```bash
ps aux | grep docling-serve
lsof -i :5002
curl http://127.0.0.1:5002/health
```

## Architecture

### Files

| File | Purpose |
|------|---------|
| `lib/docling-starter.js` | Auto-start module for web server |
| `lib/docling-client.js` | REST API client |
| `electron/docling-manager.js` | Auto-start module for Electron app |
| `server.js` | Integration point (startup + shutdown) |
| `startup.sh` | Enhanced startup script with docling |
| `start.sh` | Quick start script |

### Shutdown Handling

Both `SIGINT` (Ctrl+C) and `SIGTERM` trigger graceful shutdown:

1. Disconnect MCP clients
2. Send `SIGTERM` to docling-serve
3. Wait 5 seconds
4. Force kill with `SIGKILL` if still running

### Process Ownership

- **Managed by server:** docling-serve is a child process
- **Lifecycle:** Tied to the web server process
- **Logs:** Piped to stdout/stderr with `[Docling]` prefix

## Best Practices

1. **Let auto-start handle it** — don't manually start docling-serve unless debugging
2. **Check logs** if conversion fails — look for `[Docling]` entries
3. **Disable if not needed** — toggle off in Settings to save resources
4. **Use the startup script** for production deployments

## Differences: Web vs Electron

| Feature | Web Server (`server.js`) | Electron App |
|---------|-------------------------|--------------|
| Auto-start | ✅ Via `docling-starter.js` | ✅ Via `docling-manager.js` |
| Shutdown | ✅ Graceful on SIGINT/SIGTERM | ✅ Graceful on app quit |
| Config source | `.cc-config.json` | App data directory |
| Logs | Server stdout | Electron main process |

## Performance

- **Memory:** ~200-400MB (EasyOCR models loaded)
- **Startup:** 2-5 seconds (binary) + 10-30 seconds (model loading)
- **CPU:** Minimal when idle, spikes during document conversion

## Security

- **Localhost only:** Binds to 127.0.0.1 (not exposed to network)
- **No authentication:** Runs on localhost, trusted environment
- **Sandboxed:** Separate process, crashes don't affect main server

## Future Enhancements

- [ ] Auto-restart on crash
- [ ] Configurable model paths
- [ ] Multi-instance support (load balancing)
- [ ] Metrics and monitoring endpoint
- [ ] Docker integration
