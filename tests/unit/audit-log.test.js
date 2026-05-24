const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  initAuditLog,
  logEvent,
  getAuditLogPath,
  EVENT_TYPES,
} = require("../../lib/audit-log");

describe("audit-log", () => {
  let testDir;

  beforeEach(() => {
    // Create a temporary directory for each test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "audit-test-"));
    initAuditLog(testDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it("should initialize audit log file", () => {
    const logPath = getAuditLogPath();
    assert.ok(logPath, "Audit log path should be set");
    assert.ok(fs.existsSync(logPath), "Audit log file should exist");
  });

  it("should log a basic event with all fields", () => {
    const result = logEvent({
      event: EVENT_TYPES.REVIEW_STARTED,
      userId: "test-user",
      ip: "127.0.0.1",
      meta: { file: "test.js" },
    });

    assert.strictEqual(result, true, "logEvent should return true on success");

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");
    const lines = content.trim().split("\n");

    assert.strictEqual(lines.length, 1, "Should have one log entry");

    const entry = JSON.parse(lines[0]);
    assert.strictEqual(entry.event, EVENT_TYPES.REVIEW_STARTED);
    assert.strictEqual(entry.userId, "test-user");
    assert.strictEqual(entry.ip, "127.0.0.1");
    assert.deepStrictEqual(entry.meta, { file: "test.js" });
    assert.ok(entry.ts, "Should have timestamp");
    assert.ok(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(entry.ts),
      "Timestamp should be ISO 8601 format",
    );
  });

  it("should use defaults for missing userId and ip", () => {
    logEvent({
      event: EVENT_TYPES.SETTINGS_CHANGED,
    });

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");
    const entry = JSON.parse(content.trim());

    assert.strictEqual(entry.userId, "anonymous");
    assert.strictEqual(entry.ip, "unknown");
    assert.deepStrictEqual(entry.meta, {});
  });

  it("should append multiple events without overwriting", () => {
    logEvent({ event: EVENT_TYPES.AUTH_LOGIN, userId: "user1" });
    logEvent({ event: EVENT_TYPES.REVIEW_STARTED, userId: "user2" });
    logEvent({ event: EVENT_TYPES.REVIEW_COMPLETED, userId: "user2" });

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");
    const lines = content.trim().split("\n");

    assert.strictEqual(lines.length, 3, "Should have three log entries");

    const entries = lines.map((line) => JSON.parse(line));
    assert.strictEqual(entries[0].event, EVENT_TYPES.AUTH_LOGIN);
    assert.strictEqual(entries[0].userId, "user1");
    assert.strictEqual(entries[1].event, EVENT_TYPES.REVIEW_STARTED);
    assert.strictEqual(entries[1].userId, "user2");
    assert.strictEqual(entries[2].event, EVENT_TYPES.REVIEW_COMPLETED);
    assert.strictEqual(entries[2].userId, "user2");
  });

  it("should support all event types", () => {
    const eventTypes = [
      EVENT_TYPES.AUTH_LOGIN,
      EVENT_TYPES.AUTH_LOGOUT,
      EVENT_TYPES.AUTH_FAILED,
      EVENT_TYPES.REVIEW_STARTED,
      EVENT_TYPES.REVIEW_COMPLETED,
      EVENT_TYPES.REVIEW_EXPORTED,
      EVENT_TYPES.SETTINGS_CHANGED,
      EVENT_TYPES.USER_CREATED,
      EVENT_TYPES.USER_DELETED,
    ];

    eventTypes.forEach((eventType) => {
      logEvent({ event: eventType, userId: "test" });
    });

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");
    const lines = content.trim().split("\n");

    assert.strictEqual(lines.length, eventTypes.length);

    lines.forEach((line, idx) => {
      const entry = JSON.parse(line);
      assert.strictEqual(entry.event, eventTypes[idx]);
    });
  });

  it("should handle complex metadata objects", () => {
    const complexMeta = {
      grade: "B+",
      categories: ["XSS", "SQLi", "CSRF"],
      findings: 12,
      nested: {
        level1: {
          level2: "deep value",
        },
      },
    };

    logEvent({
      event: EVENT_TYPES.REVIEW_COMPLETED,
      userId: "reviewer",
      ip: "192.168.1.100",
      meta: complexMeta,
    });

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");
    const entry = JSON.parse(content.trim());

    assert.deepStrictEqual(entry.meta, complexMeta);
  });

  it("should return false for invalid event (missing event string)", () => {
    const result = logEvent({
      userId: "test",
    });

    assert.strictEqual(result, false, "Should return false for invalid event");

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");
    assert.strictEqual(content, "", "Should not write invalid entries");
  });

  it("should warn but still log unknown event types", () => {
    const result = logEvent({
      event: "custom.unknown.event",
      userId: "test",
    });

    assert.strictEqual(
      result,
      true,
      "Should still log unknown event types for forward compatibility",
    );

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");
    const entry = JSON.parse(content.trim());

    assert.strictEqual(entry.event, "custom.unknown.event");
  });

  it("should preserve JSON-lines format with newlines", () => {
    logEvent({ event: EVENT_TYPES.AUTH_LOGIN, userId: "user1" });
    logEvent({ event: EVENT_TYPES.AUTH_LOGOUT, userId: "user1" });

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");

    // Each line should be valid JSON
    const lines = content.split("\n").filter((l) => l.trim());
    assert.strictEqual(lines.length, 2);

    lines.forEach((line) => {
      assert.doesNotThrow(
        () => JSON.parse(line),
        "Each line should be valid JSON",
      );
    });

    // File should end with a newline
    assert.ok(content.endsWith("\n"), "File should end with newline");
  });

  it("should handle null or undefined meta gracefully", () => {
    logEvent({
      event: EVENT_TYPES.SETTINGS_CHANGED,
      userId: "test",
      ip: "127.0.0.1",
      meta: null,
    });

    const logPath = getAuditLogPath();
    const content = fs.readFileSync(logPath, "utf8");
    const entry = JSON.parse(content.trim());

    assert.deepStrictEqual(
      entry.meta,
      {},
      "Null meta should default to empty object",
    );
  });
});
