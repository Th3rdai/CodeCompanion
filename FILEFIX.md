# FILEFIX — Project Folder vs Chat Folder Separation

## Goal

Split folder semantics into:

| Config key      | UI label                      | Role                                                                                                                           |
| --------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `projectFolder` | **Settings → Project Folder** | **Security boundary.** All file safety checks and write/read allowlists are anchored here.                                     |
| `chatFolder`    | **File Browser path input**   | **Active context** for prompt context, File Browser tree root, and terminal working directory. Must be inside `projectFolder`. |

**Rule:** `chatFolder` must be equal to or nested within `projectFolder`. If unset/invalid, fallback to `projectFolder`.

---

## Validation Rules (Server-Side Contract)

- `chatFolder` save is accepted only if:
  - path exists and is a directory
  - resolved realpath is `projectFolder` or starts with `projectFolder + path.sep`
- Any invalid `chatFolder` at load or runtime falls back to `projectFolder`
- Security checks (`validateProjectFilePath`, write/read gates, folder scans) always use `projectFolder`
- UX context (prompt tree, file browser root, terminal CWD) uses `chatFolder`

**Known limitation:** fallback only fires at config load time. If `chatFolder` is deleted from disk after startup, the server keeps using the stale path until restart or the next `/api/config` POST that triggers a re-resolve.

---

## Implementation Status (2026-04-25)

| Area                          | File(s)                            | State                                                                            |
| ----------------------------- | ---------------------------------- | -------------------------------------------------------------------------------- |
| Config schema/defaults        | `lib/config.js`                    | **DONE** (`chatFolder` exists, defaults set)                                     |
| Config API validation/persist | `routes/config.js`                 | **DONE** (`chatFolder` validated to remain inside `projectFolder`)               |
| Prompt context root           | `routes/chat.js`                   | **DONE** (`getCachedProjectPrompt(config.chatFolder \|\| config.projectFolder)`) |
| File routes rooting           | `routes/files.js`                  | **DONE** (tree + read both default to `chatFolder \|\| projectFolder`)           |
| Terminal CWD split            | `lib/builtin-agent-tools.js`       | **DONE** (`chatFolder \|\| projectFolder` for default CWD)                       |
| App state split               | `src/App.jsx`                      | **DONE** (`chatFolder` state added, FileBrowser passed `chatFolder`)             |
| File Browser persistence      | `src/components/FileBrowser.jsx`   | **DONE** (App.jsx `onSetFolder` POSTs `chatFolder`)                              |
| Settings copy update          | `src/components/SettingsPanel.jsx` | **DONE** ("System access boundary" copy)                                         |

---

## Phase C — Verification + Tests

- [x] **C1** Tests for new invariants (`tests/unit/chat-folder.test.js` — 15 tests, all passing):
  - config validation (`chatFolder` inside/outside `projectFolder`)
  - terminal CWD resolution uses `chatFolder`
  - files tree root follows `chatFolder`
  - fallback to `projectFolder` when `chatFolder` invalid/unset
  - **Also fixed:** `lib/config.js` — removed `chatFolder` from static defaults so `normalizeProjectFolder` always inherits from `projectFolder` when absent from saved config.
- [ ] **C2** Update docs/changelog notes after implementation.

---

## Verification Checklist (Gate to Merge)

- [x] `chatFolder` cannot be saved outside `projectFolder` (enforced in `routes/config.js`)
- [x] Terminal commands start in `chatFolder` by default (`lib/builtin-agent-tools.js`)
- [x] File Browser opens at `chatFolder` and persists changes to `chatFolder` (`src/App.jsx`)
- [x] Security-sensitive file operations are still bounded by `projectFolder` (`validateCwd`, `assertResolvedPathUnderAllowedRoots`)
- [x] Invalid/missing `chatFolder` auto-falls back to `projectFolder` at load time (`lib/config.js` `normalizeProjectFolder`)
- [x] Unit/integration tests pass for new invariants (C1 — 15 tests, all green)
