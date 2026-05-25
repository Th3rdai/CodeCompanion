import { useState, useEffect } from "react";
import { Settings, Eye, EyeOff } from "lucide-react";
import CollapsibleSection from "./CollapsibleSection";

const WIDGET_KEYS = {
  recentWork: { key: "cc.dashboard.show.recentWork", label: "Recent Work", default: true },
  quickStats: { key: "cc.dashboard.show.quickStats", label: "Quick Stats", default: true },
  activity: { key: "cc.dashboard.show.activity", label: "7-Day Activity", default: true },
  modeBreakdown: { key: "cc.dashboard.show.modeBreakdown", label: "Mode Breakdown", default: true },
  modelBreakdown: { key: "cc.dashboard.show.modelBreakdown", label: "Model Breakdown", default: true },
};

/**
 * Get widget visibility from localStorage
 * @param {string} key - localStorage key
 * @param {boolean} defaultValue - default visibility
 * @returns {boolean} visibility state
 */
function getWidgetVisibility(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Set widget visibility in localStorage
 * @param {string} key - localStorage key
 * @param {boolean} value - visibility state
 */
function setWidgetVisibility(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

/**
 * DashboardSettings - Widget visibility toggles
 * Allows users to show/hide dashboard sections
 */
export default function DashboardSettings() {
  const [visibility, setVisibility] = useState(() => {
    const initial = {};
    Object.entries(WIDGET_KEYS).forEach(([id, { key, default: defaultValue }]) => {
      initial[id] = getWidgetVisibility(key, defaultValue);
    });
    return initial;
  });

  const handleToggle = (widgetId) => {
    const newValue = !visibility[widgetId];
    setVisibility((prev) => ({ ...prev, [widgetId]: newValue }));
    setWidgetVisibility(WIDGET_KEYS[widgetId].key, newValue);
  };

  const visibleCount = Object.values(visibility).filter(Boolean).length;

  return (
    <CollapsibleSection
      title="Dashboard Settings"
      meta={`${visibleCount}/${Object.keys(WIDGET_KEYS).length} visible`}
      storageKey="cc.dashboard.settings"
      defaultOpen={false}
    >
      <div className="glass rounded-xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <Settings className="w-5 h-5 text-indigo-400 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-white">Widget Visibility</h3>
            <p className="text-xs text-slate-400 mt-1">
              Show or hide dashboard sections. Changes are saved automatically.
            </p>
          </div>
        </div>

        <div className="space-y-3 mt-4">
          {Object.entries(WIDGET_KEYS).map(([id, { label }]) => (
            <label
              key={id}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={visibility[id]}
                onChange={() => handleToggle(id)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-[#0c0f1a] cursor-pointer"
              />
              <div className="flex items-center gap-2 flex-1">
                {visibility[id] ? (
                  <Eye className="w-4 h-4 text-indigo-400" />
                ) : (
                  <EyeOff className="w-4 h-4 text-slate-500" />
                )}
                <span className={`text-sm ${visibility[id] ? "text-slate-200" : "text-slate-500"}`}>
                  {label}
                </span>
              </div>
            </label>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

/**
 * Hook to check if a widget should be shown
 * @param {string} widgetId - Widget identifier (recentWork, quickStats, etc.)
 * @returns {boolean} Whether the widget should be shown
 */
export function useWidgetVisibility(widgetId) {
  const [isVisible, setIsVisible] = useState(() => {
    const config = WIDGET_KEYS[widgetId];
    if (!config) return true;
    return getWidgetVisibility(config.key, config.default);
  });

  useEffect(() => {
    const config = WIDGET_KEYS[widgetId];
    if (!config) return;

    // Listen for storage events from other tabs/windows
    const handleStorageChange = (e) => {
      if (e.key === config.key) {
        try {
          const newValue = e.newValue !== null ? JSON.parse(e.newValue) : config.default;
          setIsVisible(newValue);
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [widgetId]);

  // Also poll localStorage every second to catch same-tab changes
  useEffect(() => {
    const config = WIDGET_KEYS[widgetId];
    if (!config) return;

    const interval = setInterval(() => {
      const current = getWidgetVisibility(config.key, config.default);
      setIsVisible(current);
    }, 1000);

    return () => clearInterval(interval);
  }, [widgetId]);

  return isVisible;
}
