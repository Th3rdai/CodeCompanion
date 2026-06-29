const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const entitlementsPath = path.join(
  __dirname,
  "../../resources/entitlements.mac.plist",
);

test("mac entitlements include microphone for hardened runtime builds", () => {
  const xml = fs.readFileSync(entitlementsPath, "utf8");
  assert.match(xml, /com\.apple\.security\.device\.audio-input/);
  assert.match(xml, /com\.apple\.security\.device\.microphone/);
});

test("electron-builder wires mac entitlements plist", () => {
  const config = fs.readFileSync(
    path.join(__dirname, "../../electron-builder.config.js"),
    "utf8",
  );
  assert.match(config, /entitlements:\s*"resources\/entitlements\.mac\.plist"/);
  assert.match(
    config,
    /entitlementsInherit:\s*"resources\/entitlements\.mac\.inherit\.plist"/,
  );
});
