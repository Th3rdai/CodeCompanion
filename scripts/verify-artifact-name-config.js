#!/usr/bin/env node
/**
 * Ensures electron-builder keeps artifactName aligned with updater YAML (npm `name`, no spaces).
 * Run in CI on every PR; release workflow also runs this before uploading to GitHub.
 */
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "electron-builder.config.js");
const c = fs.readFileSync(configPath, "utf8");
const template = "${name}-${version}-${arch}.${ext}";
const hasSingle = c.includes(`artifactName: '${template}'`);
const hasDouble = c.includes(`artifactName: "${template}"`);
if (!hasSingle && !hasDouble) {
  console.error(
    `electron-builder.config.js must contain:\n  artifactName: '${template}'\n` +
      "so latest-*.yml url entries match GitHub Release asset filenames.",
  );
  process.exit(1);
}
console.log("ok: artifactName");
