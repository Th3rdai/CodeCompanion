# Archive manifest

Policy: Nothing here is imported at runtime. Safe to delete after grep confirmation + one release cycle.

| Category     | Path prefix               | Moved (date) | Notes                                        |
| ------------ | ------------------------- | ------------ | -------------------------------------------- |
| root-plans   | `!ARCHIVES/root-plans/`   | 2026-06-04   | Superseded planning / fix docs from root     |
| root-html    | `!ARCHIVES/root-html/`    | 2026-06-04   | `fix_cache.html` troubleshooting helper      |
| landing      | `!ARCHIVES/landing/`      | 2026-06-04   | GitHub Pages marketing stub (not packaged)   |
| root-assets  | `!ARCHIVES/root-assets/`  | —            | Optional local PNG housekeeping (gitignored) |
| code-orphans | `!ARCHIVES/code-orphans/` | 2026-06-04   | Orphaned runtime code (not imported)         |

## root-plans (28 files)

Completed dashboards, MCP/terminal/response fixes, phase analyses, and related review artifacts formerly at repo root. Active status: `docs/DASHBOARD-STATUS.md`.

## code-orphans

| File                 | Former path                         | Notes                                                                  |
| -------------------- | ----------------------------------- | ---------------------------------------------------------------------- |
| `DashboardPanel.jsx` | `src/components/DashboardPanel.jsx` | Superseded by `dashboard/DashboardView`; was not imported in `App.jsx` |

## pre-vite-public

Legacy assets from pre-Vite migration (existing).
