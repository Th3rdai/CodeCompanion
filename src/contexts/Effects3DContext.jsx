import { createContext, useContext, useState, useEffect } from "react";

// ── Theme Presets ──────────────────────────────────
export const THEME_PRESETS = [
  {
    id: "indigo-night",
    label: "Indigo Night",
    primary: "#6366f1",
    secondary: "#a855f7",
    tertiary: "#60a5fa",
    hue: 239,
  },
  {
    id: "emerald-matrix",
    label: "Emerald Matrix",
    primary: "#10b981",
    secondary: "#34d399",
    tertiary: "#6ee7b7",
    hue: 160,
  },
  {
    id: "sunset-blaze",
    label: "Sunset Blaze",
    primary: "#f97316",
    secondary: "#fb923c",
    tertiary: "#fbbf24",
    hue: 25,
  },
  {
    id: "cherry-blossom",
    label: "Cherry Blossom",
    primary: "#ec4899",
    secondary: "#f472b6",
    tertiary: "#a78bfa",
    hue: 330,
  },
  {
    id: "arctic-blue",
    label: "Arctic Blue",
    primary: "#0ea5e9",
    secondary: "#38bdf8",
    tertiary: "#7dd3fc",
    hue: 199,
  },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

// Generate a full theme from a single hue value (0-360)
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return (
    "#" +
    [f(0), f(8), f(4)]
      .map((x) =>
        Math.round(x * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function themeFromHue(hue) {
  return {
    id: `custom-${hue}`,
    label: `Custom (${hue}°)`,
    primary: hslToHex(hue, 72, 67),
    secondary: hslToHex((hue + 30) % 360, 65, 70),
    tertiary: hslToHex((hue - 30 + 360) % 360, 60, 72),
    hue,
  };
}

function applyThemeToDOM(theme) {
  const s = document.documentElement.style;
  s.setProperty("--color-brand", theme.primary);
  s.setProperty("--color-neon", theme.primary);
  s.setProperty("--color-neon-rgb", hexToRgb(theme.primary));
  s.setProperty("--color-neon-glow", `rgba(${hexToRgb(theme.primary)}, 0.4)`);
  s.setProperty("--color-brand-blue", theme.tertiary);
  s.setProperty("--color-brand-purple", theme.secondary);
  s.setProperty("--color-cyan", theme.tertiary);
  s.setProperty("--color-secondary", theme.secondary);
  s.setProperty("--color-tertiary", theme.tertiary);
}

// ── Context ────────────────────────────────────────
const EFFECTS_KEY = "th3rdai_3d_effects";
const THEME_KEY = "th3rdai_theme";

const HUE_KEY = "th3rdai_theme_hue";

const Effects3DContext = createContext({
  enabled: true,
  setEnabled: () => {},
  theme: THEME_PRESETS[0],
  setThemeId: () => {},
  customHue: null,
  setCustomHue: () => {},
});

export function Effects3DProvider({ children }) {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(EFFECTS_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || "indigo-night";
    } catch {
      return "indigo-night";
    }
  });

  const [customHue, setCustomHue] = useState(() => {
    try {
      const saved = localStorage.getItem(HUE_KEY);
      return saved !== null ? parseInt(saved, 10) : null;
    } catch {
      return null;
    }
  });

  // If custom hue is set and themeId is 'custom', generate theme from hue
  const theme =
    customHue !== null && themeId.startsWith("custom")
      ? themeFromHue(customHue)
      : THEME_PRESETS.find((t) => t.id === themeId) || THEME_PRESETS[0];

  useEffect(() => {
    try {
      localStorage.setItem(EFFECTS_KEY, String(enabled));
    } catch {}
  }, [enabled]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, themeId);
    } catch {}
    if (customHue !== null) {
      try {
        localStorage.setItem(HUE_KEY, String(customHue));
      } catch {}
    }
    applyThemeToDOM(theme);
  }, [themeId, theme, customHue]);

  // Helper: set hue from slider (switches to custom theme automatically)
  function applyHue(hue) {
    setCustomHue(hue);
    setThemeId(`custom-${hue}`);
  }

  // Helper: select a preset (clears custom hue)
  function selectPreset(id) {
    setCustomHue(null);
    setThemeId(id);
    try {
      localStorage.removeItem(HUE_KEY);
    } catch {}
  }

  return (
    <Effects3DContext.Provider
      value={{
        enabled,
        setEnabled,
        theme,
        setThemeId: selectPreset,
        customHue,
        setCustomHue: applyHue,
      }}
    >
      {children}
    </Effects3DContext.Provider>
  );
}

export function use3DEffects() {
  return useContext(Effects3DContext);
}
