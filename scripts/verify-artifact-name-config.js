#!/usr/bin/env node
/**
 * Ensures electron-builder keeps artifactName aligned with updater YAML (npm `name`, no spaces).
 * Run in CI on every PR; release workflow also runs this before uploading to GitHub.
 */
const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "electron-builder.config.js");
const c = fs.readFileSync(configPath, "utf8");
const expected = "artifactName: '${name}-${version}-${arch}.${ext}'";
if (!c.includes(expected)) {
  console.error(
    `electron-builder.config.js must contain exactly:\n  ${expected}\n` +
      "so latest-*.yml url entries match GitHub Release asset filenames.",
  );
  process.exit(1);
}
console.log("ok: artifactName");
