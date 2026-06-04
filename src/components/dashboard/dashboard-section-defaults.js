/**
 * Default expand/collapse state for dashboard sections (first visit + layout migrations).
 * Matches the shipped "See Home →" layout: settings + analytics collapsed; recent work + mode grid open.
 */
export const DASHBOARD_LAYOUT_VERSION = 2;

export const DASHBOARD_LAYOUT_VERSION_KEY = "cc.dashboard.layoutVersion";

/** @type {Record<string, boolean>} storageKey → default isOpen */
export const DASHBOARD_SECTION_DEFAULTS = {
  "cc.dashboard.settings": false,
  "cc.dashboard.recentWork": true,
  "cc.dashboard.featureGrid": true,
  "cc.dashboard.quickStats": false,
  "cc.dashboard.activity": false,
  "cc.dashboard.modeBreakdown": false,
  "cc.dashboard.modelBreakdown": false,
};

/**
 * One-time migration when layout defaults change — applies without wiping widget visibility toggles.
 */
export function migrateDashboardLayoutDefaults() {
  try {
    if (
      localStorage.getItem(DASHBOARD_LAYOUT_VERSION_KEY) ===
      String(DASHBOARD_LAYOUT_VERSION)
    ) {
      return;
    }
    for (const [key, isOpen] of Object.entries(DASHBOARD_SECTION_DEFAULTS)) {
      localStorage.setItem(key, JSON.stringify(isOpen));
    }
    localStorage.setItem(
      DASHBOARD_LAYOUT_VERSION_KEY,
      String(DASHBOARD_LAYOUT_VERSION),
    );
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @param {string | undefined} storageKey
 * @param {boolean} defaultOpen prop fallback when key is absent from map
 */
export function getDashboardSectionDefaultOpen(storageKey, defaultOpen = true) {
  if (storageKey && storageKey in DASHBOARD_SECTION_DEFAULTS) {
    return DASHBOARD_SECTION_DEFAULTS[storageKey];
  }
  return defaultOpen;
}
