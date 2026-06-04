/** Per Settings project folder: last File Browser root (survives restarts if server fell back to project root). */
export const FILE_BROWSER_ROOTS_KEY = "cc_file_browser_roots";

export function readFileBrowserRootsMap() {
  try {
    return JSON.parse(localStorage.getItem(FILE_BROWSER_ROOTS_KEY) || "{}");
  } catch {
    return {};
  }
}

export function writeFileBrowserRootsMap(map) {
  try {
    localStorage.setItem(FILE_BROWSER_ROOTS_KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota */
  }
}

export function isPathUnderProjectRoot(projectRoot, candidate) {
  const pr = String(projectRoot || "").replace(/\/+$/, "");
  const c = String(candidate || "").replace(/\/+$/, "");
  if (!pr || !c) return false;
  return c === pr || c.startsWith(`${pr}/`);
}
