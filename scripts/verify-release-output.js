#!/usr/bin/env node
/**
 * Per-platform CI: after electron-builder, ensure release/ contains updater feeds.
 * Catches missing latest-*.yml before artifacts are uploaded.
 */
const fs = require("fs");
const path = require("path");

const platform = process.argv[2] || process.env.PLATFORM;
const releaseDir = path.join(process.cwd(), "release");

const LINUX_FEEDS = ["latest-linux.yml", "latest-linux-arm64.yml"];

if (!["mac", "win", "linux"].includes(platform)) {
  console.error("usage: verify-release-output.js <mac|win|linux>");
  process.exit(1);
}

if (!fs.existsSync(releaseDir)) {
  console.error(
    "::error::release/ directory missing — electron-builder did not produce output",
  );
  process.exit(1);
}

if (platform === "linux") {
  const ok = LINUX_FEEDS.some((f) => fs.existsSync(path.join(releaseDir, f)));
  if (!ok) {
    console.error(
      `::error::release/ must include one of: ${LINUX_FEEDS.join(", ")}`,
    );
    process.exit(1);
  }
} else {
  const file = platform === "mac" ? "latest-mac.yml" : "latest.yml";
  const p = path.join(releaseDir, file);
  if (!fs.existsSync(p)) {
    console.error(
      `::error::missing ${file} — electron-updater needs this file on GitHub Releases. ` +
        "Ensure electron-builder.config.js has publish.provider github and zip targets for each OS.",
    );
    process.exit(1);
  }
}

console.log(`ok: release/ has updater metadata (${platform})`);
