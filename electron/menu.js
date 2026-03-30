const { Menu, shell } = require("electron");

/**
 * Creates the application menu
 * Includes: Edit, View, Window, Help
 * No File menu (app is self-contained per user decision)
 *
 * @param {object} [options]
 * @param {() => void} [options.reloadAppHome] — load the local app URL (recovery if navigation ever stuck)
 */
function createMenu(options = {}) {
  const { reloadAppHome } = options;

  const viewSubmenu = [
    ...(reloadAppHome
      ? [
          {
            label: "Go to app home",
            accelerator:
              process.platform === "darwin" ? "Alt+Command+H" : "Ctrl+Shift+H",
            click: () => reloadAppHome(),
          },
          { type: "separator" },
        ]
      : []),
    { role: "reload" },
    { role: "forceReload" },
    { role: "toggleDevTools" },
    { type: "separator" },
    { role: "resetZoom" },
    { role: "zoomIn" },
    { role: "zoomOut" },
    { type: "separator" },
    { role: "togglefullscreen" },
  ];

  const template = [
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: viewSubmenu,
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Learn More",
          click: async () => {
            // TODO: Update with actual GitHub repo URL when available
            await shell.openExternal(
              "https://github.com/th3rdai/code-companion",
            );
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

module.exports = {
  createMenu,
};
