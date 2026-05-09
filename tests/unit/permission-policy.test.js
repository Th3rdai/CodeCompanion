/**
 * Regression lock: shrinking this allowlist back to media-only breaks the
 * toolbar Paste / Copy buttons in the Electron app. The previous incident:
 * v1.6.42 added pasteFromClipboardButton but the permission handler still
 * denied every non-"media" request, so navigator.clipboard.readText() and
 * document.execCommand("paste") both got blocked at the Chromium gate.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  TRUSTED_ORIGIN_PERMISSIONS,
} = require("../../electron/permission-policy");

test("permission allowlist exposes clipboard read+write so toolbar Paste/Copy work", () => {
  assert.ok(
    TRUSTED_ORIGIN_PERMISSIONS.has("clipboard-read"),
    "clipboard-read must stay in the allowlist (Paste button)",
  );
  assert.ok(
    TRUSTED_ORIGIN_PERMISSIONS.has("clipboard-sanitized-write"),
    "clipboard-sanitized-write must stay in the allowlist (Copy Response button)",
  );
});

test("permission allowlist still permits media (audio-only path covers Web Speech)", () => {
  assert.ok(TRUSTED_ORIGIN_PERMISSIONS.has("media"));
});

test("electron/main.js imports the allowlist (not a private re-declaration)", () => {
  // Catches the easy revert: someone reintroduces a hardcoded
  // `if (permission !== "media") return false` in main.js.
  const main = fs.readFileSync(
    path.join(__dirname, "..", "..", "electron", "main.js"),
    "utf8",
  );
  assert.match(
    main,
    /TRUSTED_ORIGIN_PERMISSIONS.*require\(["']\.\/permission-policy["']\)/,
    "main.js must import TRUSTED_ORIGIN_PERMISSIONS from ./permission-policy",
  );
  assert.ok(
    !/permission\s*!==\s*["']media["']/.test(main),
    "main.js must not gate permissions with a hardcoded 'permission !== \"media\"' check",
  );
});
