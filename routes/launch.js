const express = require("express");
const fs = require("fs");

const { getConfig } = require("../lib/config");
const { CLIENT_INTERNAL_ERROR } = require("../lib/client-errors");

// Try to load the Electron IDE launcher if available (in Electron mode)
let ideLauncher = null;
try {
  if (process.env.CC_DATA_DIR || process.versions.electron) {
    ideLauncher = require("../electron/ide-launcher");
  }
} catch (err) {
  // Not in Electron mode or module not found - will use legacy macOS commands
  console.log("[IDE Launcher] Running in dev mode, using macOS-only commands");
}

// F-06 fix: validate folder path for IDE launch — reject dangerous characters
function _validateIDEFolder(folder) {
  if (!folder || typeof folder !== "string") return false;
  // Reject newlines, semicolons, pipes, backticks, $() — shell metacharacters
  if (/[\n\r;|`$]/.test(folder)) return false;
  return fs.existsSync(folder);
}

module.exports = function createRouter(appContext) {
  const router = express.Router();
  const { log } = appContext;

  // ── POST /api/launch-claude-code ──────────────────────
  router.post("/launch-claude-code", async (req, res) => {
    const { projectPath } = req.body;
    const folder = projectPath || getConfig().projectFolder;
    if (!folder)
      return res.status(400).json({ error: "No project folder specified" });
    if (!_validateIDEFolder(folder))
      return res.status(400).json({ error: "Invalid folder path" });

    try {
      if (ideLauncher) {
        await ideLauncher.launchIDE("claude-code", folder);
        log("INFO", `Launched Claude Code in: ${folder}`);
        res.json({ success: true, folder });
      } else {
        const { execFile } = require("child_process");
        const safeFolder = folder.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
        const script = `tell application "Terminal"\n  activate\n  do script "cd " & quoted form of "${safeFolder}" & " && claude"\nend tell`;
        execFile("osascript", ["-e", script], { stdio: "ignore" }, () => {});
        log("INFO", `Launched Claude Code in: ${folder} (macOS only)`);
        res.json({ success: true, folder });
      }
    } catch (err) {
      log("ERROR", "launch-claude-code failed", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/launch-cursor ───────────────────────────
  router.post("/launch-cursor", async (req, res) => {
    const { projectPath } = req.body;
    const folder = projectPath || getConfig().projectFolder;
    if (!folder)
      return res.status(400).json({ error: "No project folder specified" });
    if (!_validateIDEFolder(folder))
      return res.status(400).json({ error: "Invalid folder path" });

    try {
      if (ideLauncher) {
        await ideLauncher.launchIDE("cursor", folder);
        log("INFO", `Launched Cursor in: ${folder}`);
        res.json({ success: true, folder });
      } else {
        const cursorCli =
          "/Applications/Cursor.app/Contents/Resources/app/bin/cursor";
        if (fs.existsSync(cursorCli)) {
          const { execFile } = require("child_process");
          execFile(cursorCli, [folder], {
            detached: true,
            stdio: "ignore",
          }).unref();
        } else {
          const { execSync } = require("child_process");
          execSync(`open -a "Cursor" "${folder}"`);
        }
        log("INFO", `Launched Cursor in: ${folder} (macOS only)`);
        res.json({ success: true, folder });
      }
    } catch (err) {
      log("ERROR", "launch-cursor failed", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/launch-windsurf ─────────────────────────
  router.post("/launch-windsurf", async (req, res) => {
    const { projectPath } = req.body;
    const folder = projectPath || getConfig().projectFolder;
    if (!folder)
      return res.status(400).json({ error: "No project folder specified" });
    if (!_validateIDEFolder(folder))
      return res.status(400).json({ error: "Invalid folder path" });

    try {
      if (ideLauncher) {
        await ideLauncher.launchIDE("windsurf", folder);
        log("INFO", `Launched Windsurf in: ${folder}`);
        res.json({ success: true, folder });
      } else {
        const { execFile } = require("child_process");
        const windsurfCli =
          "/Applications/Windsurf.app/Contents/Resources/app/bin/windsurf";
        if (fs.existsSync(windsurfCli)) {
          execFile(windsurfCli, [folder], {
            detached: true,
            stdio: "ignore",
          }).unref();
        } else {
          const { execSync } = require("child_process");
          execSync(`open -a "Windsurf" "${folder}"`);
        }
        log("INFO", `Launched Windsurf in: ${folder} (macOS only)`);
        res.json({ success: true, folder });
      }
    } catch (err) {
      log("ERROR", "launch-windsurf failed", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/launch-vscode ───────────────────────────
  router.post("/launch-vscode", async (req, res) => {
    const { projectPath } = req.body;
    const folder = projectPath || getConfig().projectFolder;
    if (!folder)
      return res.status(400).json({ error: "No project folder specified" });
    if (!_validateIDEFolder(folder))
      return res.status(400).json({ error: "Invalid folder path" });

    try {
      if (ideLauncher) {
        await ideLauncher.launchIDE("vscode", folder);
        log("INFO", `Launched VS Code in: ${folder}`);
        res.json({ success: true, folder });
      } else {
        const { execFile, execSync } = require("child_process");
        try {
          execFile("code", [folder], {
            detached: true,
            stdio: "ignore",
            shell: process.platform === "win32",
          }).unref();
        } catch {
          if (process.platform === "darwin") {
            const bundleCli =
              "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code";
            if (fs.existsSync(bundleCli)) {
              execFile(bundleCli, [folder], {
                detached: true,
                stdio: "ignore",
              }).unref();
            } else {
              execSync(`open -a "Visual Studio Code" "${folder}"`);
            }
          } else {
            throw new Error(
              'VS Code "code" command not found in PATH. Open VS Code → Command Palette → "Shell Command: Install \'code\' command in PATH"',
            );
          }
        }
        log("INFO", `Launched VS Code in: ${folder} (${process.platform})`);
        res.json({ success: true, folder });
      }
    } catch (err) {
      log("ERROR", "launch-vscode failed", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  // ── POST /api/launch-opencode ─────────────────────────
  router.post("/launch-opencode", async (req, res) => {
    const { projectPath } = req.body;
    const folder = projectPath || getConfig().projectFolder;
    if (!folder)
      return res.status(400).json({ error: "No project folder specified" });
    if (!_validateIDEFolder(folder))
      return res.status(400).json({ error: "Invalid folder path" });

    try {
      if (ideLauncher) {
        await ideLauncher.launchIDE("opencode", folder);
        log("INFO", `Launched OpenCode in: ${folder}`);
        res.json({ success: true, folder });
      } else {
        const { execFile } = require("child_process");
        execFile(
          "open",
          ["-a", "Terminal", folder],
          { stdio: "ignore" },
          () => {},
        );
        log("INFO", `Launched OpenCode in: ${folder} (macOS only)`);
        res.json({ success: true, folder });
      }
    } catch (err) {
      log("ERROR", "launch-opencode failed", { error: err.message });
      res.status(500).json({ error: CLIENT_INTERNAL_ERROR });
    }
  });

  return router;
};
