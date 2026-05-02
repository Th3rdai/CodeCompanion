"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");

/**
 * Packaged macOS app: `~/Library/Application Support/code-companion/.cc-config.json`
 * (see electron/data-manager.js — `userData` / app name).
 */
function macPackagedConfigDir(homedir, platform) {
  if (platform !== "darwin") return null;
  const dir = path.join(
    homedir,
    "Library",
    "Application Support",
    "code-companion",
  );
  return fs.existsSync(path.join(dir, ".cc-config.json")) ? dir : null;
}

/**
 * Directory whose `.cc-config.json` should drive **`npm run mcp:clients:test`** /
 * **`scripts/test-mcp-clients.js`**.
 *
 * Resolution (do not simplify without updating **tests/unit/resolve-mcp-test-config-root.test.js**):
 * 1. **`CC_DATA_DIR`** if set and **`$CC_DATA_DIR/.cc-config.json`** exists.
 * 2. Else the candidate with the **newest file mtime** among:
 *    - repo root
 *    - **`CodeCompanion-Data/`** under the repo (unpackaged Electron)
 *    - packaged macOS app support (see **`macPackagedConfigDir`**)
 * 3. If none of those files exist, **`repoRoot`** (config loader applies defaults).
 *
 * Rationale: **`node server.js`** uses repo `.cc-config.json`; packaged Electron and
 * many dev flows use a **newer** app-data copy after saving Settings — newest wins so
 * the smoke test matches the UI without always exporting **`CC_DATA_DIR`**.
 */
function resolveMcpTestConfigRoot(repoRoot, options = {}) {
  const homedir = options.homedir ?? os.homedir();
  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;

  const explicit = env.CC_DATA_DIR;
  if (
    explicit &&
    fs.existsSync(path.join(explicit, ".cc-config.json"))
  ) {
    return explicit;
  }

  const candidates = [
    repoRoot,
    path.join(repoRoot, "CodeCompanion-Data"),
    macPackagedConfigDir(homedir, platform),
  ].filter(Boolean);

  let best = repoRoot;
  let bestMtime = -1;
  for (const dir of candidates) {
    const cfgPath = path.join(dir, ".cc-config.json");
    if (!fs.existsSync(cfgPath)) continue;
    try {
      const t = fs.statSync(cfgPath).mtimeMs;
      if (t > bestMtime) {
        bestMtime = t;
        best = dir;
      }
    } catch {
      /* skip */
    }
  }
  return best;
}

module.exports = {
  resolveMcpTestConfigRoot,
  macPackagedConfigDir,
};
