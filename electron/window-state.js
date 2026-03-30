const fs = require("fs");
const path = require("path");
const { screen } = require("electron");

/**
 * Loads window state from window-state.json
 * Returns defaults if file doesn't exist or if saved bounds are invalid
 */
function loadWindowState(dataDir) {
  const stateFile = path.join(dataDir, "window-state.json");
  const defaults = {
    width: 1200,
    height: 800,
    isMaximized: true,
  };

  try {
    if (fs.existsSync(stateFile)) {
      const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));

      // Validate saved bounds are still visible on current displays
      if (saved.x !== undefined && saved.y !== undefined) {
        const displays = screen.getAllDisplays();
        const isVisible = displays.some((display) => {
          const { x, y, width, height } = display.bounds;
          return (
            saved.x >= x &&
            saved.y >= y &&
            saved.x < x + width &&
            saved.y < y + height
          );
        });

        if (!isVisible) {
          console.log(
            "[Window State] Saved position is off-screen, using defaults",
          );
          return defaults;
        }
      }

      return { ...defaults, ...saved };
    }
  } catch (err) {
    console.error("[Window State] Error loading state:", err);
  }

  return defaults;
}

/**
 * Saves window state to window-state.json
 */
function saveWindowState(win, dataDir) {
  try {
    const bounds = win.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: win.isMaximized(),
    };

    const stateFile = path.join(dataDir, "window-state.json");
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
    console.log("[Window State] Saved:", state);
  } catch (err) {
    console.error("[Window State] Error saving state:", err);
  }
}

module.exports = {
  loadWindowState,
  saveWindowState,
};
