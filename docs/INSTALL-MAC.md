# Code Companion v1.5.3 - macOS Installation Guide

## ✅ Build Complete

**Apple Silicon (M1/M2/M3) build available!**

### Installation Options

**Option 1: DMG Installer (Recommended)**
- **File:** `Code Companion-1.5.3-arm64.dmg` (≈180 MB; exact size varies by build)
- **Installation:** Drag app to Applications folder
- ⭐ **Recommended - traditional macOS experience**

**Option 2: ZIP Archive (Portable)**
- **File:** `Code Companion-1.5.3-arm64-mac.zip` (≈183 MB)
- **Installation:** Extract and run from anywhere
- No installation required, self-contained

---

## 🚀 Installation Steps (DMG)

1. **Download** `Code Companion-1.5.3-arm64.dmg`
2. **Double-click** the DMG file to mount it
3. **Drag** Code Companion.app to the Applications folder
4. **Eject** the DMG (right-click → Eject)
5. **Launch** from Applications or Spotlight

---

## 🔓 First Launch - Gatekeeper Warning

**macOS will show:** "Code Companion cannot be opened because the developer cannot be verified"

**This is normal for unsigned apps.** Code Companion is safe but not code-signed (requires expensive Apple Developer certificate).

**To run:**
1. **Right-click** (or Control-click) on Code Companion.app
2. Select **"Open"** from the menu
3. Click **"Open"** in the dialog that appears
4. macOS will remember your choice - no warning on future launches

**Alternative method:**
1. System Settings → Privacy & Security
2. Scroll to "Security" section
3. Click **"Open Anyway"** next to the Code Companion message
4. Click **"Open"** in the confirmation dialog

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

## What's New in v1.5.3

### Desktop & docs
- **Software Updates (Electron)** — After an update is found, use **Download update** (then **Restart** when ready). **Check for updates** only checks the server; it does not download by itself.
- **Install docs** — macOS data path corrected to **`~/Library/Application Support/code-companion/`** (matches Electron `userData`).

### Also in recent releases (v1.5.2 and earlier)

#### 🔒 Security & release alignment
- **CSP nonces** for production HTML; **generic** server error messages to clients; **CI** dependency audit (`npm audit` critical gate).
- **GitHub token** validation cached briefly to reduce API calls.
- **Releases** — Installers ship from **th3rdai/CodeCompanion** Releases (in-app Software Updates when assets are published).

#### 🚀 Docling Auto-Start
- Automatic document conversion (PDF, DOCX, PPTX, Excel, PowerPoint)
- Auto-starts docling-serve on app launch
- No manual setup required

#### 🎨 UI Improvements
- **Prominent project folder path display** with gradient background
- Larger, clearer text in File Browser
- Better visibility and contrast

#### 🔧 Technical Enhancements
- macOS data uses standard Application Support (`~/Library/Application Support/code-companion/`)
- Graceful shutdown handling
- Improved startup scripts
- Comprehensive documentation

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

## 📋 Build Information

- **Version:** 1.5.3 (see `package.json` for the exact release you installed)
- **Build Date:** 2026-03-20
- **Architecture:** Apple Silicon (ARM64)
- **Electron:** 41.0.3
- **Node.js:** 22.x
- **macOS:** 11.0+ (Big Sur and later)

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

---

## 🆘 Need Help?

- **GitHub Issues:** https://github.com/Th3rdai/CodeCompanion/issues
- **Documentation:** Built-in help in the app
- **Ollama:** https://ollama.ai

---

## 📝 Notes

- **Code Signing:** Not signed (requires expensive Apple Developer certificate)
- **Gatekeeper:** Normal warning for unsigned apps - safe to bypass
- **Intel Macs:** Use Rosetta 2 or build from source
- **Data Location:** Standard macOS location (~/Library/Application Support)
- **Updates:** In-app **Software Updates** when GitHub Release includes updater metadata (`latest-mac.yml`, etc.); otherwise download a new DMG/ZIP from Releases
- **Firewall:** May need manual firewall allow on first run

---

**Enjoy using Code Companion!** 🚀
