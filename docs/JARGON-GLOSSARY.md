# Jargon Glossary

Plain-English definitions for technical terms you'll see in AI-generated code, reviews, and chat. Built for **vibe coders** — no judgment, everyone starts somewhere.

## Opening the glossary

1. Click **📖 Glossary** in the **main header** (top right, next to **GitHub** and **Files**).
2. The glossary opens in the **right-side panel** (same slot as File Browser and GitHub — only one panel at a time).
3. Click **📖 Glossary** again or **✕** in the panel header to close.

The header button shows an **indigo highlight** when the glossary panel is open.

## Using the panel

| Control            | What it does                                                                           |
| ------------------ | -------------------------------------------------------------------------------------- |
| **Search**         | Filter terms by name or definition text                                                |
| **Category pills** | All, Architecture, Data, Frontend, Infrastructure, Process, Security                   |
| **Term cards**     | Term name, category badge, one-paragraph definition                                    |
| **Scroll**         | Full term list scrolls inside the panel; main chat/dashboard stays visible on the left |

## Inline definitions in chat

When the AI uses jargon in a response, terms may appear with **hover tooltips** (via `JargonTooltip` / `highlightJargon` in `MarkdownContent`). The glossary panel is the full searchable reference; inline highlights are a quick backup while reading.

## Desktop vs web

Works the same in the **browser** (`npm run dev`) and **Electron** desktop app. After pulling UI changes, rebuild for desktop:

```bash
npm run build
npm run electron:run
```

## Implementation reference

| Piece         | Location                                                                    |
| ------------- | --------------------------------------------------------------------------- |
| Panel UI      | `src/components/JargonGlossary.jsx` → `GlossaryPanel`                       |
| Header toggle | `src/App.jsx` (`showGlossary`, mutual exclusion with GitHub / File Browser) |
| Term data     | `GLOSSARY` export in `JargonGlossary.jsx` (~69 terms, 7 categories)         |
| UI tests      | `tests/ui/glossary.spec.js`, `tests/ui/JargonGlossary.spec.js`              |

## Related

- **Setup Assistant** may mention the glossary during onboarding (`SetupAssistantPanel.jsx`).
- **Agent Readiness** — [docs/AGENT-READINESS.md](./AGENT-READINESS.md) (project folder + File Browser context).
