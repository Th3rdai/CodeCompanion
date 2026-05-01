# Builder modes — “Load from file” markdown standard

All four builder panels (Prompting, Skillz, Agentic, Planner / Plan Designer) use the same **baseline rules** for parsing user-provided `.md` files into form fields. Mode-specific logic lives in `src/lib/*-parse-loaded.js` and builds on **`src/lib/builder-markdown-standards.js`**.

## Shared rules (standards)

1. **BOM** — Strip a leading UTF-8 BOM (`U+FEFF`) before any match so `#` headings are detected.
2. **Line endings** — Treat **CRLF** and **LF** the same (`\r?\n` in patterns).
3. **YAML frontmatter** — Optional block must match:
   - `---` + newline + body + newline + `---` + newline + remainder
   - Implemented as `splitYamlFrontmatter()` in `builder-markdown-standards.js`.
4. **ATX H1 titles** — First plan/skill/agent title uses a **single** `#` (not `##`):
   - `# Title` or `#Title` (space optional after `#` when the next character is not `#`).
5. **`##` section split** — Split on `\r?\n##\s+` (flexible space after `##`).
6. **File starts with `##`** — If the document begins with `##` and no leading newline, normalize by prefixing `\n` before splitting so the first segment is the true preamble (may be empty).
7. **Section chunks** — For each segment after the first, the **first line** is the heading; the rest is the body (`parseH2SectionChunk()`).
8. **Unknown `##` sections** — Do not drop content:
   - **Planner** — merge into **Implementation Steps** in file order (before the explicit “Implementation steps” body when both exist).
   - **Skillz** — merge into **Instructions** (same ordering idea).
   - **Agentic** — merge into **Instructions** after preamble/orphans, explicit **Instructions** section last.
   - **Prompting** — only an extra **`## Constraints`** block is supported beyond the main body; there is no open-ended `##` merge.

## Mode entry points

| Mode      | Parser                      | Primary `buildContent` shape                                                                                                                               |
| --------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Prompting | `prompting-parse-loaded.js` | YAML + prompt body + optional `## Constraints` (split even when frontmatter is omitted)                                                                    |
| Skillz    | `skillz-parse-loaded.js`    | Optional YAML (`name`, `description` via `parseYamlScalarField`) + `#` title + sections per skill spec                                                     |
| Agentic   | `agentic-parse-loaded.js`   | Optional YAML (`description`, optional `name`/`title` if no `#` H1) + `#` agent + `##` sections; tool bullets accept `- **n**: d`, `- n — d`, or `- n - d` |
| Planner   | `planner-parse-loaded.js`   | Optional YAML (`title`, `description` → goal) via `parseYamlScalarField` + `#` plan + `##` + preamble `Goal:`                                              |

## Related: Security remediation ZIP parsing

Security **Remediate** ZIP assembly (`src/lib/security-remediation-zip.js`, used from `SecurityPanel.jsx`) parses the same style of delimiter-sensitive blobs:

- **`---FILE: path---` then `\r?\n` then body then `---END_FILE---`** — CRLF after the FILE line is accepted.
- **Markdown code fences** — opening fence may be followed by `\r?\n`.
- **Multi-file originals** (`── File: path ──` blocks) — first line break is `\r?\n`-aware; trailing `\r` on the path line is stripped.

Tests: `tests/unit/security-remediation-zip.test.js`.

## Header matching (disambiguation)

- Match **more specific** section titles before **looser** ones (e.g. **Input Pattern** before a generic **instruction** substring).
- Prefer **word-boundary** or **anchored** checks (`^purpose\b`, `^tools\b`) to avoid false positives (`microscope`, `architecture overview`, etc., handled per mode).

## Tests

- Shared helpers: `tests/unit/builder-markdown-standards.test.js`
- Per-mode parsers: `tests/unit/*-parse-loaded.test.js` (dynamic `import()` of `src/lib/*.js`).

When changing `buildContent` or `parseLoaded` for any builder, update the paired parser and extend the relevant unit tests so load/save round-trips stay aligned.
