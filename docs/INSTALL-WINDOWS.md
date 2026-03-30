# Code Companion — Windows installation guide

> **Filenames** use the npm package name **`code-companion`**, version, and arch (see [`electron-builder.config.js`](../electron-builder.config.js) `artifactName`). Example: `code-companion-1.5.x-x64.exe`. Exact names match [GitHub Releases](https://github.com/th3rdai/CodeCompanion/releases).

## ✅ Build Complete

**Both x64 (Intel/AMD) and ARM64 builds available!**

### Option 1: NSIS Installer (Recommended)

**x64 (Intel/AMD - Most Windows PCs):**

- **File:** `code-companion-<version>-x64.exe` (size varies by build; often ~180 MB+)
- **Installation:** Run the installer, follow prompts
- ⭐ **Recommended for most users**

**ARM64 (ARM-based Windows):**

- **File:** `code-companion-<version>-arm64.exe` (size varies by build)
- **Installation:** Run the installer, follow prompts
- For Windows on ARM (Surface Pro X, etc.)

### Option 2: ZIP Archive (Portable)

**x64 (Intel/AMD):**

- **File:** `code-companion-<version>-x64.zip`
- Extract and run `Code Companion.exe`

**ARM64 (ARM-based Windows):**

- **File:** `code-companion-<version>-arm64.zip`
- Extract and run `Code Companion.exe`

---

## 🚀 Installation Steps (NSIS Installer)

1. **Download** the appropriate `.exe` for your CPU architecture from [Releases](https://github.com/th3rdai/CodeCompanion/releases)
2. **Double-click** `code-companion-<version>-x64.exe` or `code-companion-<version>-arm64.exe`
3. **Choose installation directory** (default: `C:\Users\YourName\AppData\Local\Programs\Code Companion`)
4. **Select options:**
   - ✅ Create Desktop Shortcut (recommended)
   - ✅ Create Start Menu Shortcut (recommended)
5. Click **Install**
6. **Launch** automatically after installation (optional)

---

## 🔍 Which Build Do I Need?

**Not sure?** Most Windows PCs use **x64 (Intel/AMD)**.

Check your system:

1. Press `Win + Pause/Break` or `Win + I` → System → About
2. Look at **System type:**
   - `x64-based processor` → Use **x64** installer
   - `ARM64-based processor` → Use **ARM64** installer

---

## 📁 Data Storage Location

**Windows uses the portable approach:**

```
C:\Users\YourName\AppData\Local\Programs\Code Companion\CodeCompanion-Data\
```

Or next to the executable if using the portable ZIP version.

**Contains:**

- Configuration files (`.cc-config.json`)
- Conversation history
- Memory data
- Logs

---

## System Requirements

- **OS:** Windows 10 (1809+) or Windows 11
- **Architecture:** x64 (Intel/AMD) or ARM64
- **RAM:** 4GB minimum, 8GB recommended
- **Disk:** 1GB free space
- **.NET Framework:** 4.5+ (usually pre-installed)

---

## What's New in v1.5.14

### Desktop & release

- **CI + release checks** — Workflow verifies **`latest-*.yml`** artifacts and that **`GITHUB_REPOSITORY`** matches the app’s publish target before upload.
- **Software Updates** — Plain-language status; **Open download page** always available; external links open in the system browser.
- **Electron** — **View → Go to app home** (Ctrl+Shift+H) if navigation gets stuck; stricter in-window vs external URL handling.

### Also in recent releases (v1.5.3 and earlier)

#### 🔒 Security & release alignment

- **CSP nonces** for production HTML; **generic** server error messages to clients; **CI** dependency audit (`npm audit` critical gate).
- **GitHub token** validation cached briefly to reduce API calls.
- **Releases** — Installers from **th3rdai/CodeCompanion** Releases (in-app Software Updates when assets are published).

#### 🚀 Docling Auto-Start

- Automatic document conversion (PDF, DOCX, PPTX, Excel, PowerPoint)
- Auto-starts docling-serve on app launch
- No manual setup required

#### 🎨 UI Improvements

- **Prominent project folder path display** with gradient background
- Larger, clearer text in File Browser
- Better visibility and contrast

#### 🔧 Technical Enhancements

- Graceful shutdown handling
- Improved startup scripts
- Comprehensive documentation
- Portable data directory

---

## 🛠️ Installation Options

### Standard Installation (NSIS)

**Features:**

- ✅ Guided installer
- ✅ Automatic updates
- ✅ Start Menu integration
- ✅ Desktop shortcut
- ✅ Uninstaller included
- ✅ File associations (optional)

**Location:**

- Default: `C:\Users\YourName\AppData\Local\Programs\Code Companion\`
- Customizable during installation

### Portable Installation (ZIP)

**Features:**

- ✅ No installation required
- ✅ Run from any folder (USB drive, network share)
- ✅ Self-contained data folder
- ✅ No registry changes

**How to use:**

1. Extract ZIP to desired location
2. Run `Code Companion.exe`
3. Data saves in `CodeCompanion-Data` folder next to exe

---

## 🔓 Windows SmartScreen Warning

**First run warning:** "Windows protected your PC"

**This is normal for unsigned apps.** Code Companion is safe but not code-signed (requires expensive certificate).

**To run:**

1. Click **"More info"**
2. Click **"Run anyway"**

After first run, Windows remembers and won't show the warning again.

---

## Troubleshooting

### "Windows protected your PC" Warning

1. Click "More info"
2. Click "Run anyway"
3. Windows will remember your choice

### Installer Won't Run

**Right-click** → **Run as Administrator**

### "Missing .dll" Errors

Install Visual C++ Redistributables:

- Download from: https://aka.ms/vs/17/release/vc_redist.x64.exe
- Run installer
- Restart Code Companion

### Firewall Blocks Connection

**Allow through firewall:**

1. Windows Security → Firewall & network protection
2. Allow an app through firewall
3. Find "Code Companion" → Check Private and Public
4. Click OK

### Ollama Not Found

Install Ollama for Windows: https://ollama.ai

```cmd
ollama --version
```

### Port 8900 Already in Use

Another app is using the default port.

**Change port in settings:**

1. Open Code Companion
2. Settings (⚙️) → General
3. Change port to 8901 or another free port
4. Restart app

---

## 🗑️ Uninstall

### NSIS Installation

**Method 1 - Start Menu:**

1. Start Menu → Code Companion → Uninstall
2. Follow prompts

**Method 2 - Settings:**

1. Windows Settings → Apps → Installed apps
2. Find "Code Companion"
3. Click **Uninstall**

### Portable Installation

1. Close Code Companion
2. Delete the folder containing `Code Companion.exe`

---

## 📋 Build Information

- **Version:** See `package.json` on the tag you installed (current development line: **1.5.14**)
- **Build Date:** 2026-03-27 (for v1.5.14 tag)
- **Architectures:** x64, ARM64
- **Electron:** 41.0.2
- **Node.js:** Bundled with Electron (no separate install for end users)
- **Installer:** NSIS (Nullsoft Scriptable Install System); portable builds are **ZIP** archives

---

## 🔧 Command Line Options

Default per-user install (NSIS) places the app under **Local Programs** (not `Program Files`):

```cmd
# Launch Code Companion (adjust YourName)
"%LOCALAPPDATA%\Programs\Code Companion\Code Companion.exe"

# Launch with custom port
"%LOCALAPPDATA%\Programs\Code Companion\Code Companion.exe" --port=8901

# Launch with debugging
"%LOCALAPPDATA%\Programs\Code Companion\Code Companion.exe" --debug
```

---

## 🆘 Need Help?

- **GitHub Issues:** https://github.com/Th3rdai/CodeCompanion/issues
- **Documentation:** Built-in help in the app
- **Ollama:** https://ollama.ai

---

## 📝 Notes

- **Code Signing:** Not signed (requires expensive certificate)
- **SmartScreen:** Normal warning for unsigned apps - safe to bypass
- **Portable:** Data stays with the app (easy to move)
- **Updates:** In-app **Software Updates** when the GitHub Release includes updater metadata (`latest.yml`, etc.); otherwise download the latest **`code-companion-…`** assets from [Releases](https://github.com/th3rdai/CodeCompanion/releases)
- **Firewall:** May need manual firewall allow on first run

---

**Enjoy using Code Companion!** 🚀
