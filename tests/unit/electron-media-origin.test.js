"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  isPrivateLanIPv4,
  isLocalOrPrivateLanHostname,
  isTrustedMediaPageUrl,
} = require("../../electron/media-origin.js");

test("isLocalOrPrivateLanHostname covers localhost and IPv6 loopback", () => {
  assert.equal(isLocalOrPrivateLanHostname("localhost"), true);
  assert.equal(isLocalOrPrivateLanHostname("127.0.0.1"), true);
  assert.equal(isLocalOrPrivateLanHostname("[::1]"), true);
  assert.equal(isLocalOrPrivateLanHostname("8.8.8.8"), false);
});

test("isPrivateLanIPv4 matches RFC1918 and loopback IPv4", () => {
  assert.equal(isPrivateLanIPv4("192.168.1.5"), true);
  assert.equal(isPrivateLanIPv4("10.0.0.1"), true);
  assert.equal(isPrivateLanIPv4("172.16.0.1"), true);
  assert.equal(isPrivateLanIPv4("172.31.255.1"), true);
  assert.equal(isPrivateLanIPv4("127.0.0.1"), true);
  assert.equal(isPrivateLanIPv4("8.8.8.8"), false);
});

test("isTrustedMediaPageUrl allows localhost with port", () => {
  const ctx = { actualPort: 8900, appPath: "/app", electronDir: "/e" };
  assert.equal(isTrustedMediaPageUrl("https://localhost:8900/", ctx), true);
  assert.equal(isTrustedMediaPageUrl("http://127.0.0.1:8900/", ctx), true);
});

test("isTrustedMediaPageUrl LAN requires matching actualPort", () => {
  const ctx = { actualPort: 8900, appPath: "/app", electronDir: "/e" };
  assert.equal(isTrustedMediaPageUrl("https://192.168.1.7:8900/", ctx), true);
  assert.equal(isTrustedMediaPageUrl("https://192.168.1.7:9999/", ctx), false);
});

test("isTrustedMediaPageUrl file URL under electronDir", () => {
  const electronDir = path.join("/Users", "me", "proj", "electron");
  const splash = path.join(electronDir, "splash.html");
  const fileUrl = pathToFileURL(splash).href;
  const ctx = { actualPort: 8900, appPath: "/other", electronDir };
  assert.equal(isTrustedMediaPageUrl(fileUrl, ctx), true);
});
