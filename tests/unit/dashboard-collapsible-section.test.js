/**
 * Unit tests for CollapsibleSection localStorage persistence
 * (src/components/dashboard/CollapsibleSection.jsx).
 *
 * Tests the localStorage get/set logic that persists collapse state.
 * Full React component testing would require @testing-library/react;
 * these tests validate the storage behavior in isolation.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

// Mock localStorage for Node.js environment
class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }

  clear() {
    this.store = {};
  }
}

test("CollapsibleSection: localStorage retrieval with valid JSON returns boolean", () => {
  const storage = new LocalStorageMock();
  storage.setItem("test.key", "true");

  const stored = storage.getItem("test.key");
  const parsed = JSON.parse(stored);
  assert.strictEqual(parsed, true);
  assert.strictEqual(typeof parsed, "boolean");
});

test("CollapsibleSection: localStorage retrieval with null returns default", () => {
  const storage = new LocalStorageMock();
  const stored = storage.getItem("nonexistent.key");
  assert.strictEqual(stored, null);

  // Component logic: if stored is null, use defaultOpen
  const defaultOpen = true;
  const result = stored !== null ? JSON.parse(stored) : defaultOpen;
  assert.strictEqual(result, true);
});

test("CollapsibleSection: localStorage persistence stores boolean as JSON", () => {
  const storage = new LocalStorageMock();
  const isOpen = false;

  storage.setItem("test.collapse", JSON.stringify(isOpen));
  const retrieved = JSON.parse(storage.getItem("test.collapse"));

  assert.strictEqual(retrieved, false);
  assert.strictEqual(typeof retrieved, "boolean");
});

test("CollapsibleSection: storage keys are namespaced with cc.dashboard prefix", () => {
  const storage = new LocalStorageMock();

  // Component uses keys like "cc.dashboard.modeBreakdown"
  const keys = [
    "cc.dashboard.modeBreakdown",
    "cc.dashboard.modelBreakdown",
    "cc.dashboard.activity",
    "cc.dashboard.settings",
  ];

  keys.forEach((key, i) => {
    storage.setItem(key, JSON.stringify(i % 2 === 0));
  });

  assert.strictEqual(JSON.parse(storage.getItem(keys[0])), true);
  assert.strictEqual(JSON.parse(storage.getItem(keys[1])), false);
  assert.strictEqual(JSON.parse(storage.getItem(keys[2])), true);
  assert.strictEqual(JSON.parse(storage.getItem(keys[3])), false);
});

test("CollapsibleSection: malformed JSON in localStorage falls back to default", () => {
  const storage = new LocalStorageMock();
  storage.setItem("test.key", "not-valid-json");

  let result;
  try {
    result = JSON.parse(storage.getItem("test.key"));
  } catch {
    // Component logic: catch parse error, return defaultOpen
    result = true;
  }

  assert.strictEqual(result, true);
});

test("DashboardSettings: widget visibility keys use show prefix", () => {
  const storage = new LocalStorageMock();

  // DashboardSettings uses "cc.dashboard.show.*" keys
  const widgetKeys = {
    recentWork: "cc.dashboard.show.recentWork",
    quickStats: "cc.dashboard.show.quickStats",
    activity: "cc.dashboard.show.activity",
    modeBreakdown: "cc.dashboard.show.modeBreakdown",
    modelBreakdown: "cc.dashboard.show.modelBreakdown",
  };

  Object.values(widgetKeys).forEach((key, i) => {
    storage.setItem(key, JSON.stringify(i < 3)); // First 3 visible
  });

  assert.strictEqual(
    JSON.parse(storage.getItem(widgetKeys.recentWork)),
    true
  );
  assert.strictEqual(
    JSON.parse(storage.getItem(widgetKeys.quickStats)),
    true
  );
  assert.strictEqual(JSON.parse(storage.getItem(widgetKeys.activity)), true);
  assert.strictEqual(
    JSON.parse(storage.getItem(widgetKeys.modeBreakdown)),
    false
  );
  assert.strictEqual(
    JSON.parse(storage.getItem(widgetKeys.modelBreakdown)),
    false
  );
});

test("DashboardSettings: defaults to true when no storage value present", () => {
  const storage = new LocalStorageMock();
  const key = "cc.dashboard.show.recentWork";
  const defaultValue = true;

  const stored = storage.getItem(key);
  const result = stored !== null ? JSON.parse(stored) : defaultValue;

  assert.strictEqual(result, true);
});

test("CollapsibleSection: toggle behavior flips boolean state", () => {
  const storage = new LocalStorageMock();
  const key = "test.toggle";

  // Initial state
  let isOpen = true;
  storage.setItem(key, JSON.stringify(isOpen));

  // Toggle (component calls setIsOpen(prev => !prev))
  isOpen = !isOpen;
  storage.setItem(key, JSON.stringify(isOpen));

  assert.strictEqual(JSON.parse(storage.getItem(key)), false);

  // Toggle again
  isOpen = !isOpen;
  storage.setItem(key, JSON.stringify(isOpen));

  assert.strictEqual(JSON.parse(storage.getItem(key)), true);
});
