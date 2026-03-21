# Chat export (toolbar)

The **Export** control in the chat toolbar opens **`ExportPanel`** (`src/components/ExportPanel.jsx`).

## Behavior

- **Source:** full conversation or **last assistant response** only.
- **Formats (11):** Markdown, Plain Text, HTML, JSON, PDF, Word (DOCX), OpenDocument Text, Excel (XLSX), OpenDocument Spreadsheet, CSV, PowerPoint (PPTX).
- **Delivery:** one format per download, or **multiple formats** (separate files or a **ZIP**).

## Server

- **`POST /api/generate-office`** — JSON body `{ content, filename }`; returns the generated file (rate-limited).
- **`GET /api/export/formats`** — metadata for supported extensions (`lib/office-generator.js`).

Implementation: **`lib/office-generator.js`**. Builtin agent tool **`generate_office_file`** reuses the same generator.

## See also

- **`CLAUDE.md`** — Project Structure and **Export (toolbar)** sections.
- **`.planning/ROADMAP.md`** — Post–roadmap enhancements (unified chat export).
