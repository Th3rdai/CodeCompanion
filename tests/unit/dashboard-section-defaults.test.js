/**
 * Unit tests for dashboard section default layout (dashboard-section-defaults.js).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DASHBOARD_LAYOUT_VERSION,
  DASHBOARD_LAYOUT_VERSION_KEY,
  DASHBOARD_SECTION_DEFAULTS,
  getDashboardSectionDefaultOpen,
  migrateDashboardLayoutDefaults,
} from "../../src/components/dashboard/dashboard-section-defaults.js";

class LocalStorageMock {
  constructor() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] ?? null;
  }

  setItem(key, value) {
    this.store[key] = String(value);
  }
}

test("getDashboardSectionDefaultOpen: known keys use shipped defaults", () => {
  assert.strictEqual(
    getDashboardSectionDefaultOpen("cc.dashboard.settings"),
    false,
  );
  assert.strictEqual(
    getDashboardSectionDefaultOpen("cc.dashboard.recentWork"),
    true,
  );
  assert.strictEqual(
    getDashboardSectionDefaultOpen("cc.dashboard.featureGrid"),
    true,
  );
  assert.strictEqual(
    getDashboardSectionDefaultOpen("cc.dashboard.quickStats"),
    false,
  );
  assert.strictEqual(
    getDashboardSectionDefaultOpen("cc.dashboard.activity"),
    false,
  );
  assert.strictEqual(
    getDashboardSectionDefaultOpen("cc.dashboard.modeBreakdown"),
    false,
  );
  assert.strictEqual(
    getDashboardSectionDefaultOpen("cc.dashboard.modelBreakdown"),
    false,
  );
});

test("getDashboardSectionDefaultOpen: unknown key falls back to prop default", () => {
  assert.strictEqual(getDashboardSectionDefaultOpen("cc.other", false), false);
  assert.strictEqual(getDashboardSectionDefaultOpen(undefined, true), true);
});

test("migrateDashboardLayoutDefaults: writes all section keys and version once", () => {
  const storage = new LocalStorageMock();
  const original = globalThis.localStorage;
  globalThis.localStorage = storage;

  try {
    migrateDashboardLayoutDefaults();

    for (const [key, isOpen] of Object.entries(DASHBOARD_SECTION_DEFAULTS)) {
      assert.strictEqual(JSON.parse(storage.getItem(key)), isOpen);
    }
    assert.strictEqual(
      storage.getItem(DASHBOARD_LAYOUT_VERSION_KEY),
      String(DASHBOARD_LAYOUT_VERSION),
    );

    storage.setItem("cc.dashboard.quickStats", "true");
    migrateDashboardLayoutDefaults();
    assert.strictEqual(
      JSON.parse(storage.getItem("cc.dashboard.quickStats")),
      true,
    );
  } finally {
    globalThis.localStorage = original;
  }
});

test("shipped layout: analytics collapsed, navigation sections expanded", () => {
  const expanded = ["cc.dashboard.recentWork", "cc.dashboard.featureGrid"];
  const collapsed = Object.keys(DASHBOARD_SECTION_DEFAULTS).filter(
    (k) => !expanded.includes(k),
  );

  for (const key of expanded) {
    assert.strictEqual(
      DASHBOARD_SECTION_DEFAULTS[key],
      true,
      `${key} should start open`,
    );
  }
  for (const key of collapsed) {
    assert.strictEqual(
      DASHBOARD_SECTION_DEFAULTS[key],
      false,
      `${key} should start closed`,
    );
  }
});
