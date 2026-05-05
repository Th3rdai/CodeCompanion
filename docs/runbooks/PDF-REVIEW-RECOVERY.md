# DOCFIX — PDF Review & MCP Remediation Plan (v4)

**Created:** 2026-05-05 (revised from v3 after plan-reviewer pass 3)
**Scope:** PDF-review failures across local Mac and cowork/cloud Claude environments
**System under review:** macOS 26.3.1 (25D2128), Apple Silicon (arm64), Claude desktop app v1.1.6452, Code Companion v1.6.39
**Estimated total time:** 25–45 min

**Cross-links:**
- **This plan owns:** Archon `6a6f9c54-...` (Cowork: re-verify codeCompanion MCP path + Docling pipx env)
- **Blocks:** Archon `7becebc7-...` (Commit local PDF-review fix)
- **Depends on (separate):** Archon `d2eb1afc-...` (Investigate big-PDF Ollama timeout), `2d41aa28-...` (Clean ~/.claude.json — folded into Step 4 here)

---

## When NOT to follow this plan

- Code Companion is newer than v1.6.39 (signature requirement may differ)
- Using the cloud-only Code Companion web version (no local install to remediate)
- The Dry Run below already passes

---

## Dry Run (30 seconds — skip the plan if all three pass)

```bash
curl -sk http://localhost:8910/api/config >/dev/null 2>&1 && echo "✓ App responding on 8910"
curl -fsS http://127.0.0.1:5002/health 2>/dev/null | grep -q ok && echo "✓ Docling-serve healthy"
defaults read "/Applications/Code Companion.app/Contents/Info.plist" CFBundleShortVersionString
```

If all three succeed AND the version output is `1.6.39`, jump to **Step 2** (acceptance test). If any fails, continue with Step 0.

---

## Glossary

| Term | What it is | Where it runs |
|---|---|---|
| **`docling-serve` REST** | Document-conversion HTTP service on `127.0.0.1:5002`. Used by Code Companion's `/api/convert-document`. uv- or pipx-managed; the live binary is at `~/.local/bin/docling-serve` regardless of installer. | Local Mac |
| **Docling MCP** | MCP server `docling-mcp-server` exposing 19 Docling tools to Claude chat. Pipx-managed in cowork VM. | Cowork VM (per current evidence) |
| **PDF Tools MCP** | Third-party MCP server `pdf-filler` v0.4.0 (analyse / extract / fill / compare PDFs). Claude Desktop extension. | Cowork (per current evidence; local last seen idle 2026-03-23) |
| **codeCompanion MCP** | MCP server in this repo (`mcp-server.js`) exposing chat / explain / find_bugs / refactor tools. | Local Mac at `/Users/james/Projects/CodeCompanion/mcp-server.js` |
| **Cowork session** | Cloud Claude session at `/sessions/relaxed-nifty-gauss/mnt/AIApp-CodeCompanion`. Different env, different MCP config, typically Linux. | Anthropic-hosted VM |
| **LaunchServices state corruption** | macOS LaunchServices DB caches per-bundle-ID launch metadata. After 3+ failed installs (bundle deleted, replaced ad-hoc-signed, replaced again), dyld silently kills the process at `_dyld_start` until LaunchServices is rebuilt (reboot or `lsregister -kill -r -domain user`). Verified today via `sample` showing 39+ second hangs in `_dyld_start` on a properly-signed bundle. | macOS 26.3+ |

---

## Environment Matrix

| Issue | Local Mac status (verified 2026-05-05) | Cowork VM status |
|---|---|---|
| **PDF Tools MCP crashes** | ❓ Not reproducible — local log ends 2026-03-23 with clean shutdown | Reported by user; needs reproduction in cowork |
| **Docling MCP fails (pipx + python3.14)** | ❌ Not reproducible — local Docling MCP started successfully 2026-05-03; no pipx-managed `docling-mcp` here (`~/.local/pipx/venvs/` has only `pip-audit`) | ✅ Reproduces — pipx venv conflict with Python 3.14 inside cowork VM |
| **codeCompanion MCP module not found** | ❌ Not reproducible — `/Users/james/Projects/CodeCompanion/mcp-server.js` exists; local log shows successful start 2026-05-03 18:21:19 | ✅ Reproduces — cowork config references mount path `/Users/james/AI_Dev/AIApp-CodeCompanion/mcp-server.js` |
| **Code Companion auto-update failed** | ✅ Resolved — Squirrel.Mac requirement-string mismatch; manual install of v1.6.39 already happened | N/A |
| **macOS 26.3 LaunchServices state corruption** | ⚠ Active risk after today's failed installs | N/A |

---

## Failure Modes (symptom → cause → diagnostic → evidence anchor)

| Symptom | Cause | First diagnostic | Evidence anchor |
|---|---|---|---|
| PDF preview shows "Ensure docling-serve is running" | `/files/read-raw` returned 404 (chatFolder ≠ projectFolder) | `grep "GET /files/read-raw" ~/Library/Application\ Support/code-companion/logs/app.log` | app.log **19:30:58 GET /files/read-raw 200** (post-fix) vs pre-fix **404** |
| Chat fabricates a 50KB+ "extracted_text.txt" via `generate_office_file` | Pre-fix bundle; FileBrowser attached an error stub as file body | `grep "generate_office_file" app.log` | app.log **19:08:55 [OFFICE] Saved /Users/james/Desktop/extracted_text.txt (53.9KB)** is the smoking gun |
| Chat dies after exactly 5 minutes with `fetch failed` | Ollama prompt-prefill timeout on big-context (>50K tokens) gemma4 | `grep "POST /chat 200 30" app.log` | app.log **19:36:30 POST /chat 200 300842ms** |
| Code Companion launches but no GUI window appears, server alive | macOS 26.3 LaunchServices corruption | `sample <pid> 1` (look for `_dyld_start` hang) | Today's session: 39s hang in `_dyld_start` on clean Developer-ID-signed v1.6.39 |
| `MODULE_NOT_FOUND` for codeCompanion MCP at `/Users/james/AI_Dev/...` | Cowork config references mount path; local config is correct | Check cowork's MCP config, not local | Local `~/Library/Application Support/Claude/claude_desktop_config.json` already correct |

---

## Step 0 — macOS 26.3 LaunchServices Hygiene

**Severity:** Critical. **Required before any /Applications mutation.**
**Time:** 5 min

```bash
# 1. Save any in-flight work in other apps. Reboot is non-destructive but
#    long-running compiles/file-watchers will be killed.
# 2. Quit Code Companion gracefully:
osascript -e 'tell application "Code Companion" to quit' 2>/dev/null
sleep 2
pkill -9 -f "/Applications/Code Companion.app" 2>/dev/null
```

**Reboot via macOS UI** (preserves state and respects user preferences):
- Apple menu → **Restart…**
- Confirm "Reopen windows when logging back in" is **unchecked**
- Click **Restart**

(Avoid `sudo shutdown -r now` — it skips the macOS reopen-windows logic and may surprise other apps.)

After reboot: do **not** launch the existing `/Applications/Code Companion.app` — proceed straight to Step 1.

---

## Step 1 — Install patched DMG

**Time:** 2 min

Two DMGs are already on disk; pick one:

| DMG | Path | Signed | Notarized | Has fix? |
|---|---|---|---|---|
| Local rebuild | `/Users/james/Projects/CodeCompanion/release/code-companion-1.6.39-arm64.dmg` | ✅ Developer ID (9LRPX62LGN) | ❌ | ✅ Read-raw + chat-post-handler guardrails |
| Official release | `~/Downloads/code-companion-1.6.39-arm64.dmg` | ✅ Developer ID | ✅ | ❌ |

### Pre-install verify

```bash
DMG="/Users/james/Projects/CodeCompanion/release/code-companion-1.6.39-arm64.dmg"
codesign --verify --strict "$DMG" 2>&1 || echo "codesign FAILED — abort"
hdiutil verify "$DMG" 2>&1 | tail -1   # must say "checksum is VALID"
spctl --assess --verbose=2 "$DMG" 2>&1 | head -3
# spctl output reading: 'rejected source=Unnotarized Developer ID' is EXPECTED
# for the local rebuild (signed but not notarized). The official DMG should
# show 'accepted' since it is notarized. Both are safe to install on this Mac.
```

### Install

1. Double-click the DMG → drag `Code Companion` to `/Applications` (replace existing).
2. First launch: macOS may show a Gatekeeper prompt for the unnotarized local rebuild. Right-click → **Open** → **Open**.

### Step 1.5 — Rollback if launch fails

**Time:** ≤10 min worst case

If after install the GUI never appears within 60 seconds and `app.log` shows no fresh activity:

```bash
# 1. Try a LaunchServices rebuild without rebooting
LSREG="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
$LSREG -kill -r -domain user 2>&1 | tail -1
$LSREG -f "/Applications/Code Companion.app"
open "/Applications/Code Companion.app"
sleep 10
# Check if it launched. If yes, skip the rest of 1.5.

# 2. Otherwise reboot a SECOND time:
pkill -9 -f "/Applications/Code Companion.app" 2>/dev/null
# Apple menu → Restart…

# After second reboot, try the OFFICIAL notarized DMG:
# Mount ~/Downloads/code-companion-1.6.39-arm64.dmg, drag to /Applications.
```

**Stop after 2 reboots.** If still hanging in `_dyld_start`, escalate — don't loop further. Notarization status alone did NOT rescue today's session; the corruption was in LaunchServices state, which a reboot clears. If two reboots haven't cleared it, something else is broken (System Integrity Protection misconfig, caches mounted read-only, etc.).

---

## Step 2 — Acceptance Test

**Time:** 5 min path A + 3 min path B

### Pre-snapshot

```bash
cp ~/Library/Application\ Support/code-companion/logs/app.log /tmp/before-test.log
```

### Test path A — read-raw + Docling fix

1. Launch Code Companion.
2. File Browser → navigate to `~/Documents`.
3. Click `TradingAgents Analysis Report - AKAM.pdf`.
4. Confirm the preview renders converted markdown (NOT "Ensure docling-serve is running").
5. **Click +Attach to Chat exactly once.** Wait for the spinner to clear before any further click. Multiple clicks would re-convert the PDF and stack copies in the chat context — pollutes the test.
6. Send: `please review and summarize this pdf`.
7. **Use `minimax-m2:cloud`** (your `selectedModel`). Do NOT use `gemma4:latest` for this test (5-minute Ollama timeout on 108K-token prompts; separate Archon `d2eb1afc-...`). If forced to use a local model, pick `qwen3:8b` for fast prefill.

**Pass criteria:**
- Response is a real summary referencing AKAM/Akamai content.
- `diff /tmp/before-test.log ~/Library/Application\ Support/code-companion/logs/app.log` shows new lines including:
  - **Exactly one** `Converting document: TradingAgents Analysis Report - AKAM.pdf` (multiple = UI-sluggishness regression)
  - **Exactly one** `POST /convert-document 200`
  - One or more `GET /files/read-raw 200` (preview + attach calls)
- No `generate_office_file` or `[WRITE_FILE]` lines in the new log entries.

### Test path B — chat-post-handler guardrail (regex match contract)

8. New conversation. Attach the same PDF (Step 3–5 again, exactly one click).
9. Send this **exact** prompt — the wording must match the regex contract for `userExplicitlyDisallowsFileWrites` (forbid cue + concrete file-target noun within 80 chars):
   ```
   summarize this PDF — don't save any files, no docx/pdf output
   ```
   (Why this specific wording: the regex is `\b(do not|don't|dont|no|without)\b[^.!?]{0,80}\b(file|files|docx|pdf|xlsx|pptx|csv|odt|ods|odp|to disk|on disk|to file)\b`. The prompt contains both `don't` near `files` AND `no` near `docx/pdf`, satisfying the contract twice.)

**Pass criteria:**
- Response is a real summary in chat.
- New `app.log` entries contain a `Blocked file-writing tool due to explicit user constraint` warning, OR contain zero `[WRITE_FILE]` / `[OFFICE]` lines for this turn.

If both paths pass, the local fix is verified end-to-end.

---

## Step 3 — Cowork remediation (skip if cowork unused)

**Time:** 10–20 min

```bash
# Inside the cowork session terminal:

# 3a. Docling MCP venv (atomic; recovers from half-broken state)
pipx install docling-mcp --python python3.12 --force

# Recovery if the above fails:
rm -rf ~/.local/pipx/venvs/docling-mcp
pipx install docling-mcp --python python3.12 --force   # --force still required

# 3b. Capture PDF Tools crash trace
# Reproduce the crash by requesting a PDF read in cowork chat. Then:
ls "$HOME/Library/Logs/Claude/mcp-server-PDF Tools - Analyze, Extract, Fill, Compare.log" 2>/dev/null \
  || ls /sessions/*/mnt/.claude/logs/ 2>/dev/null   # cowork-specific path
cp "<crash log path>" ~/Documents/cowork-pdf-tools-crash-$(date +%Y%m%d).log
# Attach the saved file to Archon task 6a6f9c54-... as evidence.
# If trace shows a known-issue pattern (e.g. SIGTERM from cowork OOM-killer),
# file upstream at https://github.com/anthropics/claude-extensions/issues

# 3c. Update cowork's codeCompanion MCP config
# Locate cowork's MCP config (varies by harness — typically /sessions/.../mcp.json
# or via Claude Desktop > Developer > Edit Config inside the cowork VM).
# Replace `/Users/james/AI_Dev/AIApp-CodeCompanion/mcp-server.js`
# with the actual mount path for the codeCompanion repo inside the VM,
# OR remove the codeCompanion entry if not needed in cowork.
```

**Python 3.12 in cowork:** the cowork VM is typically Linux. Use whatever Python 3.12 provider exists in the base image (`apt-get install python3.12`, `uv python install 3.12`, or pre-pinned `pipx --python python3.12`). Do **not** run `brew install` — Homebrew is rarely available in cowork containers.

---

## Step 4 — Local hygiene (one-shot)

**Time:** 1 min

```bash
# Backup ~/.claude.json (contains API keys — handle as secret)
BAK=~/.claude.json.bak-$(date +%Y%m%d-%H%M%S)
cp ~/.claude.json "$BAK" || { echo "Backup failed — abort"; exit 1; }
echo "Backed up to: $BAK"

# Remove the stale per-project entry (with parse-failure abort)
python3 - <<'PY'
import json, sys
p = '/Users/james/.claude.json'
try:
    c = json.load(open(p))
except Exception as e:
    print(f"parse failed, aborting: {e}", file=sys.stderr)
    sys.exit(1)

projects = c.get('projects', {})
removed = projects.pop('/Users/james/AI_Dev/CodeCompanion', None)
if not removed:
    print("Entry not present — no-op")
    sys.exit(0)

remaining = len(projects)
json.dump(c, open(p, 'w'), indent=2)
print(f"Removed entry. Project count: {remaining}")
PY
```

Verify: open `~/.claude.json`, confirm 31 project entries remain (was 32) and the broken codeCompanion path is gone. If the script reports "parse failed", **do not** retry — restore from `$BAK` and inspect manually.

(For a more durable workflow, this step can be promoted to `scripts/clean-claude-json.sh` in the repo with a `--dry-run` flag. Tracked separately as housekeeping.)

---

## Remediation Order

| Order | Action | Where | Time | Required if |
|---|---|---|---|---|
| Dry Run | Three curl + defaults check | Local | 30 s | Always — may skip rest |
| 0 | Reboot the Mac via Apple menu | Local | 5 min | Doing /Applications mutation |
| 1 | Drag-install local-rebuild DMG (or official if rollback) | Local | 2 min | Want to test PDF-review fix |
| 1.5 | LaunchServices rebuild → second reboot → official DMG | Local | ≤10 min | Step 1 fails to launch |
| 2 | Acceptance test (paths A + B) | Local | 8 min | Step 1 succeeded |
| 3 | Cowork: pipx Docling + PDF Tools trace + MCP path | Cowork | 10–20 min | Cowork session in use |
| 4 | Remove stale `~/.claude.json` project entry | Local | 1 min | Hygiene |

**Total:** 25–45 min including rollback worst case.

---

## What This Plan Is NOT

- **Not** a fix for the local 5-minute Ollama timeout on 108K-token gemma4 prompts (Archon `d2eb1afc-...` — Investigate big-PDF Ollama timeout)
- **Not** the commit of the PDF-review fix patches (Archon `7becebc7-...` — Commit local PDF-review fix; this plan unblocks it)
- **Not** packaging cleanup of `release/` directory (housekeeping, no ticket)

---

## Sign-off Checklist

- [ ] Dry Run executed; if all three checks passed at v1.6.39, jumped to Step 2
- [ ] Step 0 reboot performed before any /Applications mutation (Apple menu Restart, not `sudo shutdown`)
- [ ] Pre-install `codesign --verify --strict` and `hdiutil verify` both pass on the chosen DMG
- [ ] DMG drag-installed; first-launch Gatekeeper prompt accepted
- [ ] Step 1.5 used IF Step 1 install failed to launch — escalated after 2 reboots if still hanging
- [ ] Acceptance test path A passes — exactly one `Converting document` and one `POST /convert-document 200` in app.log diff; real summary returned
- [ ] Acceptance test path B passes — exact prompt used; either `Blocked file-writing tool` warning visible OR zero `[WRITE_FILE]`/`[OFFICE]` lines for this turn
- [ ] Cowork-side MCPs verified separately if cowork session is in use; PDF Tools crash trace attached to Archon `6a6f9c54-...`
- [ ] Stale `~/.claude.json` project entry removed; backup file kept until next sweep
- [ ] Archon task `6a6f9c54-...` → status `review` with crash-trace attachment as evidence
- [ ] Archon task `7becebc7-...` (commit local fix) — unblocked, ready to move to `doing`
