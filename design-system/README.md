# Design system (Markdown)

Design documentation for **Code Companion** lives in **`.md` files** in this directory. Prefer editing Markdown in git; PDF or other exports are optional derivatives.

## Primary doc (start here)

| File | Purpose |
|------|---------|
| [**DESIGN-STANDARDS.md**](./DESIGN-STANDARDS.md) | Colors, typography, glass system, components, layout (viewport vs content rails), accessibility, stack |

## Other references

| Path | Notes |
|------|--------|
| `code-companion/MASTER.md` | Generated / page-override design notes (v1 flow) |
| `code-companion-v2.0/MASTER.md` | Generated master + `pages/*.md` per feature area |
| `.pdf` files | Optional exports — **do not treat as canonical** |

## For contributors

- Change behavior or tokens → update **`DESIGN-STANDARDS.md`** and the code (`src/index.css`, `src/App.jsx`, components).
- Mention layout: full-width shell, `max-w-*` only inside the main column — see **DESIGN-STANDARDS.md §6**.
