# Code Companion v1.5.1 - Windows Installation Guide

## ✅ Build Complete

**Both x64 (Intel/AMD) and ARM64 builds available!**

### Option 1: NSIS Installer (Recommended)

**x64 (Intel/AMD - Most Windows PCs):**
- **File:** `Code Companion Setup 1.5.1.exe` (184 MB)
- **Installation:** Run the installer, follow prompts
- ⭐ **Recommended for most users**

**ARM64 (ARM-based Windows):**
- **File:** `Code Companion Setup 1.5.1.exe` (ARM64 version, 184 MB)
- **Installation:** Run the installer, follow prompts
- For Windows on ARM (Surface Pro X, etc.)

### Option 2: ZIP Archive (Portable)

**x64 (Intel/AMD):**
- **File:** `Code Companion-1.5.1-win.zip` (184 MB)
- Extract and run `Code Companion.exe`

**ARM64 (ARM-based Windows):**
- **File:** `Code Companion-1.5.1-arm64-win.zip` (184 MB)
- Extract and run `Code Companion.exe`

---

## 🚀 Installation Steps (NSIS Installer)

1. **Download** the appropriate installer for your CPU architecture
2. **Double-click** `Code Companion Setup 1.5.1.exe`
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

## What's New in v1.5.1

### 🚀 Docling Auto-Start
- Automatic document conversion (PDF, DOCX, PPTX, Excel, PowerPoint)
- Auto-starts docling-serve on app launch
- No manual setup required

### 🎨 UI Improvements
- **Prominent project folder path display** with gradient background
- Larger, clearer text in File Browser
- Better visibility and contrast

### 🔧 Technical Enhancements
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

- **Version:** 1.5.1
- **Build Date:** 2026-03-20
- **Architectures:** x64, ARM64
- **Electron:** 41.0.3
- **Node.js:** 22.x
- **Installer:** NSIS (Nullsoft Scriptable Install System)

---

## 🔧 Command Line Options

```cmd
# Launch Code Companion
"C:\Program Files\Code Companion\Code Companion.exe"

# Launch with custom port
"C:\Program Files\Code Companion\Code Companion.exe" --port=8901

# Launch with debugging
"C:\Program Files\Code Companion\Code Companion.exe" --debug
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
- **Updates:** Manual updates (download new installer)
- **Firewall:** May need manual firewall allow on first run

---

**Enjoy using Code Companion!** 🚀
