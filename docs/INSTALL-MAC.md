# Code Companion — macOS installation guide

> **Filenames** use the npm package name **`code-companion`**, version, and arch (see [`electron-builder.config.js`](../electron-builder.config.js) `artifactName`). Example: `code-companion-1.5.x-arm64.dmg`. Exact names match [GitHub Releases](https://github.com/th3rdai/CodeCompanion/releases).

## ✅ Build Complete

**Apple Silicon (M1/M2/M3/M4) build available.**

### Installation Options

**Option 1: DMG Installer (Recommended)**
- **File:** `code-companion-<version>-arm64.dmg` (size varies by build; often ~180 MB+)
- **Installation:** Drag app to Applications folder
- ⭐ **Recommended — traditional macOS experience**

**Option 2: ZIP Archive (Portable)**
- **File:** `code-companion-<version>-arm64.zip` (portable; size varies)
- **Installation:** Extract and run from anywhere
- No installation required, self-contained

---

## 🚀 Installation Steps (DMG)

1. **Download** the `.dmg` for your version from [Releases](https://github.com/th3rdai/CodeCompanion/releases)
2. **Double-click** the DMG file to mount it
3. **Drag** Code Companion.app to the Applications folder
4. **Eject** the DMG (right-click → Eject)
5. **Launch** from Applications or Spotlight

---

## 🔓 First Launch — Gatekeeper

What you see depends on **how the build was signed**:

| Build type | Typical experience |
|------------|-------------------|
| **Developer ID + notarization** (distribution release) | Often opens normally from Downloads or Applications; least friction. |
| **Developer ID without notarization**, or **ad-hoc** (local/dev builds) | macOS may say the **developer cannot be verified** or ask you to confirm — use **Right-click → Open** once (see below). |

Maintainer builds from source default to **ad-hoc** signing for speed; **GitHub release** builds may use **Developer ID** when published with `electron:publish:mac:release` (see **[BUILD.md](../BUILD.md)**).

**If you see “cannot be opened because the developer cannot be verified”:**

1. **Right-click** (or Control-click) **Code Companion.app**
2. Select **Open**
3. Click **Open** in the dialog
4. macOS remembers your choice for that app

**Alternative:** System Settings → Privacy & Security → **Open Anyway** (when macOS lists the blocked app).

---

## 📁 Data Storage Location

**macOS stores app data under the Electron user-data folder.** The directory name comes from the npm package name (`code-companion` in `package.json`), not the display name “Code Companion”:

```
~/Library/Application Support/code-companion/
```

**To access:**
1. Finder → Go menu → Hold Option key → Library
2. Navigate to `Application Support/code-companion/`

**Or via Terminal:**
```bash
open ~/Library/Application\ Support/code-companion/
```

**Contains:**
- Configuration files (`.cc-config.json`)
- Conversation history
- Memory data
- Logs

---

## System Requirements

- **macOS:** 11.0 (Big Sur) or later
- **Processor:** Apple Silicon (M1/M2/M3/M4)
- **RAM:** 4GB minimum, 8GB recommended
- **Disk:** 1GB free space

**Note:** Intel Macs are not supported in this release. Use Rosetta 2 translation (automatic) or build from source.

---

## Release notes

See **[GitHub Releases](https://github.com/th3rdai/CodeCompanion/releases)** for the current version, changelog, and asset filenames.

Past highlights (examples — not exhaustive):

- **Software Updates (Electron)** — After an update is found, use **Download update**, then **Restart** when ready. **Check for updates** only checks the server.
- **Docling** — Optional document conversion; can auto-start docling-serve when configured.
- **Data path** — `~/Library/Application Support/code-companion/` (Electron `userData`).

---

## 🛠️ Installation Comparison

### DMG Installation (Recommended)

**Features:**
- ✅ Traditional macOS app installation
- ✅ Lives in Applications folder
- ✅ Appears in Spotlight search
- ✅ Integrates with macOS system
- ✅ Easy to update (replace app)
- ✅ Easy to uninstall (drag to trash)

**Location:**
- `/Applications/Code Companion.app`
- Data: `~/Library/Application Support/code-companion/`

### ZIP Installation (Portable)

**Features:**
- ✅ No installation required
- ✅ Run from any folder (external drive, etc.)
- ✅ Self-contained
- ✅ No system integration needed

**How to use:**
1. Extract ZIP to desired location
2. Run `Code Companion.app`
3. Data saves in `~/Library/Application Support/code-companion/` (same as DMG)

---

## Troubleshooting

### "Cannot be opened because the developer cannot be verified"
**Solution:** Right-click → Open (see First Launch section above)

### App Won't Launch
1. Check System Requirements (Apple Silicon required)
2. Try removing quarantine attribute:
   ```bash
   xattr -cr /Applications/Code\ Companion.app
   ```
3. Check Console.app for error messages

### "Damaged and can't be opened" Error
This usually means the download was corrupted.
1. Delete the downloaded file
2. Re-download from a stable connection
3. Verify file size matches expected (180 MB for DMG, 183 MB for ZIP)

### Firewall Blocks Connection
**Allow through firewall:**
1. System Settings → Network → Firewall
2. Firewall Options
3. Add Code Companion to allowed apps
4. Click OK

### Ollama Not Found
Install Ollama for macOS: https://ollama.ai
```bash
ollama --version
```

### Port 8900 Already in Use
Another app is using the default port.

**Change port in settings:**
1. Open Code Companion
2. Settings (⚙️) → General
3. Change port to 8901 or another free port
4. Restart app

### Data Directory Not Found
If you're upgrading from an older version that used a portable data directory:
1. Old location: Next to the app or in project folder
2. Current location: `~/Library/Application Support/code-companion/`
3. The app will automatically migrate data on first run (if found in legacy locations)

---

## 🗑️ Uninstall

### DMG Installation
1. Quit Code Companion
2. Open Applications folder
3. Drag Code Companion.app to Trash
4. Empty Trash

**To remove data:**
```bash
rm -rf ~/Library/Application\ Support/code-companion/
```

### ZIP Installation
1. Quit Code Companion
2. Delete the folder containing Code Companion.app
3. Remove data folder (same as above)

---

## 📋 Build information

- **Version:** Shown in the app **About** / **Settings** and in the GitHub release tag
- **Architecture:** Apple Silicon (ARM64) for published arm64 builds
- **Requirements:** macOS 11.0+ (Big Sur and later); **Node.js** is bundled inside the Electron app (no separate install for end users)

---

## 🔧 Command Line Options

```bash
# Launch Code Companion
open -a "Code Companion"

# Launch with custom port
open -a "Code Companion" --args --port=8901

# Launch with debugging
open -a "Code Companion" --args --debug

# View logs in real-time (embedded server — same folder as config/history)
tail -f ~/Library/Application\ Support/code-companion/logs/app.log
```

More log locations (repo vs Electron dev) and connection issues: **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)**.

---

## 🆘 Need Help?

- **GitHub Issues:** https://github.com/Th3rdai/CodeCompanion/issues
- **Documentation:** Built-in help in the app
- **Ollama:** https://ollama.ai

---

## 📝 Notes

- **Code signing:** Release builds may be **Developer ID**-signed when maintainers use **`electron:build:mac:release`** / **`electron:publish:mac:release`** (see **[BUILD.md](../BUILD.md)**). Ad-hoc/local builds may still trigger a one-time Gatekeeper prompt.
- **Gatekeeper:** If macOS blocks the app, use **Right-click → Open** (see **First Launch — Gatekeeper** above).
- **Intel Macs:** Use Rosetta 2 or build from source
- **Data Location:** Standard macOS location (~/Library/Application Support)
- **Updates:** In-app **Software Updates** when GitHub Release includes updater metadata (`latest-mac.yml`, etc.); otherwise download a new DMG/ZIP from Releases
- **Firewall:** May need manual firewall allow on first run

---

**Enjoy using Code Companion!** 🚀
