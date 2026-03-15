import { createContext, useContext, useState, useEffect } from 'react';

// ── Theme Presets ──────────────────────────────────
export const THEME_PRESETS = [
  { id: 'indigo-night',    label: 'Indigo Night',    primary: '#6366f1', secondary: '#a855f7', tertiary: '#60a5fa' },
  { id: 'emerald-matrix',  label: 'Emerald Matrix',  primary: '#10b981', secondary: '#34d399', tertiary: '#6ee7b7' },
  { id: 'sunset-blaze',    label: 'Sunset Blaze',    primary: '#f97316', secondary: '#fb923c', tertiary: '#fbbf24' },
  { id: 'cherry-blossom',  label: 'Cherry Blossom',  primary: '#ec4899', secondary: '#f472b6', tertiary: '#a78bfa' },
  { id: 'arctic-blue',     label: 'Arctic Blue',     primary: '#0ea5e9', secondary: '#38bdf8', tertiary: '#7dd3fc' },
];

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function applyThemeToDOM(theme) {
  const s = document.documentElement.style;
  s.setProperty('--color-brand', theme.primary);
  s.setProperty('--color-neon', theme.primary);
  s.setProperty('--color-neon-rgb', hexToRgb(theme.primary));
  s.setProperty('--color-neon-glow', `rgba(${hexToRgb(theme.primary)}, 0.4)`);
  s.setProperty('--color-brand-blue', theme.tertiary);
  s.setProperty('--color-brand-purple', theme.secondary);
  s.setProperty('--color-cyan', theme.tertiary);
  s.setProperty('--color-secondary', theme.secondary);
  s.setProperty('--color-tertiary', theme.tertiary);
}

// ── Context ────────────────────────────────────────
const EFFECTS_KEY = 'th3rdai_3d_effects';
const THEME_KEY = 'th3rdai_theme';

const Effects3DContext = createContext({
  enabled: true, setEnabled: () => {},
  theme: THEME_PRESETS[0], setThemeId: () => {},
});

export function Effects3DProvider({ children }) {
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = localStorage.getItem(EFFECTS_KEY);
      return saved === null ? true : saved === 'true';
    } catch { return true; }
  });

  const [themeId, setThemeId] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || 'indigo-night';
    } catch { return 'indigo-night'; }
  });

  const theme = THEME_PRESETS.find(t => t.id === themeId) || THEME_PRESETS[0];

  useEffect(() => {
    try { localStorage.setItem(EFFECTS_KEY, String(enabled)); } catch {}
  }, [enabled]);

  useEffect(() => {
    try { localStorage.setItem(THEME_KEY, themeId); } catch {}
    applyThemeToDOM(theme);
  }, [themeId, theme]);

  return (
    <Effects3DContext.Provider value={{ enabled, setEnabled, theme, setThemeId }}>
      {children}
    </Effects3DContext.Provider>
  );
}

export function use3DEffects() {
  return useContext(Effects3DContext);
}
