# Docling Integration Plan — Document Reading (PDF, PPTX, DOCX, XLSX)

## Overview

Add document reading capability to Code Companion via [docling-serve](https://github.com/docling-project/docling-serve), a REST sidecar that converts PDF, PPTX, DOCX, XLSX, HTML, images, and more into structured markdown/text for AI analysis.

---

## Gap Analysis of Original Plan

### Critical Issues Found

| #   | Issue                                           | Severity | Detail                                                                                                                                                                                                                        |
| --- | ----------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **macOS port 5001 conflict**                    | HIGH     | Default docling-serve port 5001 is used by AirPlay Receiver on macOS Monterey+. Will silently fail to bind. Must default to 5002 or another free port.                                                                        |
| 2   | **5MB JSON body limit blocks uploads**          | HIGH     | `express.json({ limit: '5mb' })` is global. PDFs routinely exceed 5MB. A 20-page PDF can be 10–50MB. The convert endpoint needs a dedicated higher limit.                                                                     |
| 3   | **No multipart/form-data support**              | MEDIUM   | Server has zero multipart capability (no multer). Two options: (a) add multer for the convert endpoint, or (b) use base64-in-JSON with per-route body limit. Option (b) is simpler and consistent with existing architecture. |
| 4   | **docling-serve sync timeout is 120s**          | MEDIUM   | `DOCLING_SERVE_MAX_SYNC_WAIT` defaults to 120s. Large PDFs with OCR can exceed this. Must use async API (`/v1/convert/file/async` + poll) for reliability.                                                                    |
| 5   | **Converted output can overwhelm AI context**   | HIGH     | A 100-page PDF → markdown could be 200KB+ of text. Ollama models have limited context windows (2K–128K tokens). Need truncation, chunking, or summary strategy.                                                               |
| 6   | **Frontend file inputs reject documents**       | MEDIUM   | Current `<input type="file">` elements only accept text/code files and images. Accept attributes must be updated in Chat, Review, Security, and Builder modes.                                                                |
| 7   | **File Browser can't display documents**        | MEDIUM   | `isTextFile()` in file-browser.js only recognizes code/text extensions. Documents won't appear in the file tree or trigger conversion on click.                                                                               |
| 8   | **No offline/unavailable graceful degradation** | HIGH     | If docling-serve isn't running, uploading a PDF would fail with a cryptic error. Need clear user-facing message + fallback behavior.                                                                                          |
| 9   | **No conversion progress indicator**            | MEDIUM   | Document conversion takes 2–30+ seconds. Without a loading state, users will think the app is frozen.                                                                                                                         |
| 10  | **No API key support**                          | LOW      | docling-serve supports optional `X-Api-Key` auth via `DOCLING_SERVE_API_KEY` env var. Config should allow storing an API key.                                                                                                 |
| 11  | **No conversion caching**                       | LOW      | Same PDF uploaded twice → two conversions. Should cache by file hash (same pattern as image dedup).                                                                                                                           |
| 12  | **Security: converted markdown not sanitized**  | MEDIUM   | Converted PDFs could contain XSS payloads in text. Markdown renderer already sanitizes, but verify the pipeline.                                                                                                              |
| 13  | **Electron packaging story missing**            | LOW      | How does docling-serve run when the app is distributed as Electron? Document as external dependency (like Ollama).                                                                                                            |
| 14  | **No error handling for partial failures**      | MEDIUM   | docling-serve returns `"status": "partial_success"` or `"failure"`. Must handle all status codes and surface meaningful errors.                                                                                               |

### Assumptions Validated

| Assumption                     | Status    | Notes                                                                 |
| ------------------------------ | --------- | --------------------------------------------------------------------- |
| docling-serve has REST API     | CONFIRMED | `/v1/convert/file` (multipart) and `/v1/convert/source` (JSON/base64) |
| Health check endpoint exists   | CONFIRMED | `GET /health` returns `{"status": "ok"}`                              |
| Can convert locally (no cloud) | CONFIRMED | Runs fully local, air-gapped capable                                  |
| Markdown output available      | CONFIRMED | `to_formats: ["md"]` → `document.md_content`                          |
| Supports file upload           | CONFIRMED | Both multipart (`/v1/convert/file`) and base64 (`/v1/convert/source`) |

---

## Revised Architecture

### Integration Pattern: base64-in-JSON (matches existing architecture)

```
Frontend                    Express Server                 docling-serve
─────────                   ──────────────                 ─────────────
FileReader.readAsDataURL()
  → base64 string
  → POST /api/convert-doc   → decode base64
    (JSON, 50MB limit)        → POST /v1/convert/file
                                (multipart to docling)     → convert
                              ← md_content                 ← response
  ← { markdown, meta }     ←
  → attach as text file
```

**Why base64-in-JSON over adding multer:**

- Consistent with existing file handling (images use base64)
- No new middleware dependency
- Per-route body limit override (`express.json({ limit: '50mb' })`)
- Simpler error handling (no temp file cleanup)

### For large files (>50MB): async conversion with polling

```
Frontend                    Express Server                 docling-serve
─────────                   ──────────────                 ─────────────
POST /api/convert-doc       → POST /v1/convert/file/async → task_id
  ← { taskId, status }     ←

  (poll every 2s)
GET /api/convert-doc/status → GET /v1/status/poll/{id}    → status
  ← { status: "running" }  ←

GET /api/convert-doc/status → GET /v1/status/poll/{id}    → done
  ← { status: "success" }  ←

GET /api/convert-doc/result → GET /v1/result/{id}         → document
  ← { markdown, meta }     ←
```

---

## Implementation Plan

### Phase 1: Backend Foundation

#### 1.1 Update `lib/config.js` — Add defaults

```javascript
// In defaults object:
docling: {
  url: 'http://localhost:5002',  // NOT 5001 (macOS AirPlay conflict)
  apiKey: '',                     // Optional X-Api-Key header
  enabled: true,                  // Feature toggle
  maxFileSizeMB: 50,              // Client-side upload limit
  outputFormat: 'md',             // Default: markdown
  ocr: true,                      // Enable OCR for scanned PDFs
  ocrEngine: 'easyocr',           // Default OCR engine
  timeoutSec: 120,                // Sync conversion timeout
},
```

Add deep merge in `loadConfig()`:

```javascript
docling: { ...defaults.docling, ...(saved.docling || {}) },
```

#### 1.2 Create `lib/docling-client.js` — API wrapper

```javascript
// Core functions:
async function checkConnection(doclingUrl, apiKey)
  // GET /health with 5s timeout
  // Returns: { connected: bool, version?: string, error?: string }

async function convertDocument(doclingUrl, apiKey, fileBuffer, filename, options)
  // POST /v1/convert/file (multipart via native FormData + Blob)
  // Options: { outputFormat: 'md', ocr: true, ocrEngine: 'easyocr' }
  // Returns: { markdown: string, status: string, processingTime: number, errors: [] }
  // Handles: success, partial_success, skipped, failure

async function convertDocumentAsync(doclingUrl, apiKey, fileBuffer, filename, options)
  // POST /v1/convert/file/async
  // Returns: { taskId: string }

async function pollTaskStatus(doclingUrl, apiKey, taskId)
  // GET /v1/status/poll/{taskId}
  // Returns: { status: 'running'|'success'|'failure', position?: number }

async function getTaskResult(doclingUrl, apiKey, taskId)
  // GET /v1/result/{taskId}
  // Returns: { markdown, status, processingTime, errors }
```

**Key implementation details:**

- Use Node.js native `fetch` + `FormData` + `Blob` (Node 22 supports these)
- AbortController with configurable timeout
- Add `X-Api-Key` header when apiKey is set
- Log all calls via existing `log()` helper
- Handle network errors, timeouts, non-200 responses

#### 1.3 Update `server.js` — Add endpoints

**New endpoints:**

```
POST /api/convert-document      — Sync conversion (with per-route 50MB limit)
POST /api/convert-document/async — Start async conversion
GET  /api/convert-document/status/:taskId — Poll async status
GET  /api/convert-document/result/:taskId — Get async result
GET  /api/docling/health        — Test connection
```

**POST /api/convert-document:**

```javascript
app.post(
  "/api/convert-document",
  express.json({ limit: "50mb" }), // Override global 5MB limit
  rateLimit("convert", 10, 60000), // 10 conversions/min
  async (req, res) => {
    const config = getConfig();
    if (!config.docling?.enabled)
      return res.status(503).json({ error: "Document conversion is disabled" });

    const { content, filename } = req.body; // content = base64
    if (!content || !filename)
      return res.status(400).json({ error: "Missing content or filename" });

    // Validate file extension
    const ext = path.extname(filename).toLowerCase();
    if (!CONVERTIBLE_EXTENSIONS.has(ext)) {
      return res.status(400).json({ error: `Unsupported file type: ${ext}` });
    }

    // Decode base64 to Buffer
    const buffer = Buffer.from(content, "base64");

    // Check size limit
    const maxBytes = (config.docling.maxFileSizeMB || 50) * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return res.status(413).json({
        error: `File too large (max ${config.docling.maxFileSizeMB}MB)`,
      });
    }

    try {
      const result = await convertDocument(
        config.docling.url,
        config.docling.apiKey,
        buffer,
        filename,
        {
          outputFormat: config.docling.outputFormat,
          ocr: config.docling.ocr,
          ocrEngine: config.docling.ocrEngine,
        },
      );

      // Truncate if too large for AI context (configurable, default 100KB markdown)
      const MAX_OUTPUT = 100 * 1024;
      const truncated = result.markdown.length > MAX_OUTPUT;
      const markdown = truncated
        ? result.markdown.slice(0, MAX_OUTPUT) +
          "\n\n... (document truncated — too large for AI context)"
        : result.markdown;

      res.json({
        markdown,
        filename,
        originalSize: buffer.length,
        markdownSize: markdown.length,
        truncated,
        status: result.status,
        processingTime: result.processingTime,
        errors: result.errors,
      });
    } catch (err) {
      if (
        err.message?.includes("ECONNREFUSED") ||
        err.message?.includes("fetch failed")
      ) {
        return res.status(503).json({
          error: "Cannot reach Docling server",
          detail: `Ensure docling-serve is running at ${config.docling.url}`,
          setupHint:
            'pip install "docling-serve[ui]" && docling-serve run --port 5002',
        });
      }
      res.status(500).json({ error: "Conversion failed", detail: err.message });
    }
  },
);
```

**Update POST /api/config:**

```javascript
// Add docling config handling alongside existing ollamaUrl, imageSupport, etc.
if (req.body.docling !== undefined) {
  config.docling = { ...config.docling, ...req.body.docling };
  if (config.docling.url)
    config.docling.url = config.docling.url.replace(/\/+$/, "");
  log("INFO", `Docling config updated: ${config.docling.url}`);
}
```

**Update sanitizeConfigForClient():**

```javascript
// Mask API key like GitHub token
docling: { ...config.docling, apiKey: config.docling?.apiKey ? '••••••••' : '' },
```

#### 1.4 Update `lib/file-browser.js` — Recognize document files

```javascript
const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".pptx",
  ".docx",
  ".xlsx",
  ".html",
  ".htm", // already in TEXT_EXTENSIONS but also convertible
  ".latex",
  ".tex",
  ".csv", // already text but docling can structure it
]);

function isConvertibleDocument(filename) {
  const ext = path.extname(filename).toLowerCase();
  return DOCUMENT_EXTENSIONS.has(ext) && !TEXT_EXTENSIONS.has(ext);
  // Returns true for PDF, PPTX, DOCX, XLSX — not for HTML/CSV (already text)
}
```

Update `buildFileTree()` to include document files in the tree:

```javascript
// Change: } else if (isTextFile(entry.name)) {
// To:     } else if (isTextFile(entry.name) || isConvertibleDocument(entry.name)) {
```

Add `convertible: true` flag to document file entries so the frontend knows to convert instead of direct-read.

---

### Phase 2: Frontend — Settings UI

#### 2.1 Update `SettingsPanel.jsx` — Add Docling section

**State additions:**

```javascript
const [doclingUrl, setDoclingUrl] = useState("http://localhost:5002");
const [doclingApiKey, setDoclingApiKey] = useState("");
const [doclingEnabled, setDoclingEnabled] = useState(true);
const [doclingTesting, setDoclingTesting] = useState(false);
const [doclingTestResult, setDoclingTestResult] = useState(null);
const [doclingMaxSizeMB, setDoclingMaxSizeMB] = useState(50);
const [doclingOcr, setDoclingOcr] = useState(true);
```

**Load from config (add to existing useEffect):**

```javascript
if (data.docling) {
  setDoclingUrl(data.docling.url || "http://localhost:5002");
  setDoclingApiKey(data.docling.apiKey || "");
  setDoclingEnabled(data.docling.enabled ?? true);
  setDoclingMaxSizeMB(data.docling.maxFileSizeMB ?? 50);
  setDoclingOcr(data.docling.ocr ?? true);
}
```

**Test connection handler:**

```javascript
async function handleDoclingTest() {
  setDoclingTesting(true);
  setDoclingTestResult(null);
  try {
    // Save first, then test (matches Ollama pattern)
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        docling: { url: doclingUrl, apiKey: doclingApiKey },
      }),
    });
    const res = await fetch("/api/docling/health");
    const data = await res.json();
    setDoclingTestResult(
      data.connected
        ? {
            ok: true,
            message: data.version
              ? `Connected (v${data.version})`
              : "Connected",
          }
        : { ok: false, error: data.detail || "Cannot connect" },
    );
  } catch (err) {
    setDoclingTestResult({ ok: false, error: err.message });
  }
  setDoclingTesting(false);
}
```

**UI section (place after Ollama URL, before Project Folder):**

```jsx
{
  /* Document Conversion (Docling) */
}
<div className="border-t border-slate-700/40 pt-4 mt-4">
  <div className="flex items-center gap-3 mb-3">
    <label className="block text-sm text-slate-300 font-medium">
      Document Conversion
    </label>
    <button
      onClick={() => {
        setDoclingEnabled(!doclingEnabled); /* save */
      }}
      className={`w-9 h-5 rounded-full transition-colors ${doclingEnabled ? "bg-indigo-500" : "bg-slate-600"}`}
    >
      <span
        className={`block w-3.5 h-3.5 rounded-full bg-white transition-transform ${doclingEnabled ? "translate-x-4.5" : "translate-x-0.5"}`}
      />
    </button>
  </div>
  <p className="text-xs text-slate-500 mb-3">
    Requires{" "}
    <a
      href="https://github.com/docling-project/docling-serve"
      target="_blank"
      className="text-indigo-400 hover:underline"
    >
      docling-serve
    </a>{" "}
    running locally. Supports PDF, PPTX, DOCX, XLSX, images, and more.
  </p>
  {doclingEnabled && (
    <>
      {/* Docling Server URL + Test */}
      <label className="block text-sm text-slate-300 mb-2 font-medium">
        Docling Server URL
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={doclingUrl}
          onChange={(e) => setDoclingUrl(e.target.value)}
          placeholder="http://localhost:5002"
          className="flex-1 input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
        />
        <button
          onClick={handleDoclingTest}
          disabled={doclingTesting}
          className="btn-neon disabled:opacity-50 text-white rounded-lg px-4 py-2.5 text-sm font-medium whitespace-nowrap"
        >
          {doclingTesting ? (
            <span className="inline-block spin">&#x27F3;</span>
          ) : (
            "Test Connection"
          )}
        </button>
      </div>
      {doclingTestResult && (
        <div
          className={`mt-2 p-2.5 rounded-lg text-xs ${doclingTestResult.ok ? "bg-green-500/10 border border-green-500/30 text-green-400" : "bg-red-500/10 border border-red-500/30 text-red-400"}`}
        >
          {doclingTestResult.ok
            ? doclingTestResult.message
            : `Failed: ${doclingTestResult.error}`}
        </div>
      )}

      {/* API Key (optional) */}
      <label className="block text-sm text-slate-300 mb-2 mt-3 font-medium">
        API Key <span className="text-slate-500">(optional)</span>
      </label>
      <input
        type="password"
        value={doclingApiKey}
        onChange={(e) => setDoclingApiKey(e.target.value)}
        placeholder="Leave blank if not required"
        className="w-full input-glow text-slate-100 rounded-lg px-4 py-2.5 outline-none font-mono text-sm"
      />

      {/* OCR Toggle */}
      <div className="flex items-center gap-2 mt-3">
        <input
          type="checkbox"
          checked={doclingOcr}
          onChange={(e) => setDoclingOcr(e.target.checked)}
        />
        <label className="text-sm text-slate-300">
          Enable OCR for scanned documents
        </label>
      </div>
    </>
  )}
</div>;
```

**Save handler — add docling to the onSave call:**

```javascript
onSave({
  ollamaUrl: url,
  projectFolder: folder,
  icmTemplatePath: icmTemplate,
  // ... existing fields ...
  docling: {
    url: doclingUrl,
    apiKey: doclingApiKey,
    enabled: doclingEnabled,
    maxFileSizeMB: doclingMaxSizeMB,
    ocr: doclingOcr,
  },
});
```

---

### Phase 3: Frontend — Document Upload & Conversion

#### 3.1 Create `src/lib/document-processor.js` — Client-side handler

```javascript
// Supported document types for conversion
export const DOCUMENT_EXTENSIONS = new Set([
  ".pdf",
  ".pptx",
  ".docx",
  ".xlsx",
  ".xls",
  ".doc",
  ".ppt",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".latex",
  ".tex",
  ".epub",
]);

export const DOCUMENT_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/msword",
]);

export function isConvertibleDocument(file) {
  // Check by extension (more reliable than MIME for some types)
  const ext = "." + file.name.split(".").pop().toLowerCase();
  if (DOCUMENT_EXTENSIONS.has(ext)) return true;
  // Fallback to MIME
  return DOCUMENT_MIMES.has(file.type);
}

export async function convertDocument(file) {
  // Read file as base64
  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]); // Strip data URI prefix
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await fetch("/api/convert-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: base64, filename: file.name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Conversion failed" }));
    throw new Error(err.detail || err.error || `HTTP ${res.status}`);
  }

  return await res.json();
  // Returns: { markdown, filename, originalSize, markdownSize, truncated, status, processingTime }
}

export function getDocumentAcceptString() {
  // For <input accept="...">
  return ".pdf,.pptx,.docx,.xlsx,.xls,.doc,.ppt,.odt,.ods,.odp,.rtf,.tex,.epub";
}
```

#### 3.2 Update `src/App.jsx` — Inject conversion into upload flow

**In `handleFileUpload()`:**

```javascript
// After reading file, before attaching:
if (isConvertibleDocument(file)) {
  setConvertingDoc(file.name); // Show loading indicator
  try {
    const result = await convertDocument(file);
    // Attach as a text file with converted content
    attachFile({
      name: `${file.name} (converted)`,
      content: result.markdown,
      lines: result.markdown.split("\n").length,
      size: result.markdownSize,
      convertedFrom: file.name,
      originalSize: result.originalSize,
      truncated: result.truncated,
    });
    if (result.truncated) {
      // Warn user
      showToast(`Document was truncated (too large for AI context)`);
    }
  } catch (err) {
    showToast(`Failed to convert ${file.name}: ${err.message}`);
  } finally {
    setConvertingDoc(null);
  }
  return;
}
```

**Same injection needed in:**

- `handleDrop()` in App.jsx
- `handleFileUpload()` in ReviewPanel.jsx
- `handleDrop()` in ReviewPanel.jsx
- `handleFileUpload()` in SecurityPanel.jsx
- `handleDrop()` in SecurityPanel.jsx

**Shared helper** — Extract conversion logic into a reusable function to avoid duplicating in 6+ locations:

```javascript
// In App.jsx or a shared utility:
async function processFileForAttach(file, onProgress, onError) {
  if (isConvertibleDocument(file)) {
    onProgress?.(`Converting ${file.name}...`);
    const result = await convertDocument(file);
    return {
      name: `${file.name} (converted)`,
      content: result.markdown,
      lines: result.markdown.split("\n").length,
      size: result.markdownSize,
      convertedFrom: file.name,
      truncated: result.truncated,
      type: "converted-document",
    };
  }
  // Existing text/image handling...
}
```

#### 3.3 Update file input accept attributes

**All file inputs need updating to include document types alongside existing types:**

```jsx
// Current (example from App.jsx):
<input type="file" accept=".js,.jsx,.ts,.tsx,.py,..." />

// Updated:
<input type="file" accept=".js,.jsx,.ts,.tsx,.py,...,.pdf,.pptx,.docx,.xlsx,.xls,.doc,.ppt" />
```

Use `getDocumentAcceptString()` helper to keep the list consistent.

#### 3.4 Conversion loading indicator

```jsx
{
  /* In the input area, next to the send button: */
}
{
  convertingDoc && (
    <div className="flex items-center gap-2 text-xs text-indigo-300 animate-pulse">
      <span className="inline-block spin">&#x27F3;</span>
      Converting {convertingDoc}...
    </div>
  );
}
```

#### 3.5 Update FileBrowser.jsx — Handle document files

```jsx
// In file node rendering:
{
  node.convertible ? (
    // Show document icon + convert-on-click behavior
    <span className="text-xs text-amber-400">📄</span>
  ) : (
    <span className={`text-xs ${extColor}`}>📄</span>
  );
}
```

**On click:** Trigger conversion instead of direct read:

```javascript
async function handleFileClick(node) {
  if (node.convertible) {
    setConverting(node.path);
    try {
      // Read raw file from disk via a new endpoint
      const res = await fetch(
        `/api/files/read-raw?folder=${encodeURIComponent(projectFolder)}&path=${encodeURIComponent(node.path)}`,
      );
      const blob = await res.blob();
      const file = new File([blob], node.name);
      const result = await convertDocument(file);
      onFileSelect?.({ ...node, content: result.markdown, converted: true });
    } catch (err) {
      // Show error
    } finally {
      setConverting(null);
    }
  } else {
    // Existing text file read
  }
}
```

**New server endpoint needed:**

```
GET /api/files/read-raw?folder=...&path=...
  → Returns raw binary file (for document conversion pipeline)
  → Path traversal protection (same as readProjectFile)
  → Content-Type: application/octet-stream
```

---

### Phase 4: Edge Cases & Error Handling

#### 4.1 Graceful offline handling

```javascript
// In convertDocument():
// Check if docling is enabled before attempting
const configRes = await fetch("/api/config");
const config = await configRes.json();
if (!config.docling?.enabled) {
  throw new Error(
    "Document conversion is not enabled. Enable it in Settings → General.",
  );
}
```

**Better approach:** Cache the docling enabled state in App.jsx and gate the UI:

```javascript
// In App.jsx state:
const [doclingAvailable, setDoclingAvailable] = useState(false);

// On mount + after settings save:
useEffect(() => {
  fetch("/api/docling/health")
    .then((r) => r.json())
    .then((d) => setDoclingAvailable(d.connected))
    .catch(() => setDoclingAvailable(false));
}, []);
```

When docling is unavailable and user uploads a PDF:

```
"This file type requires Docling for conversion.
 Set up Docling in Settings → General to read PDF files."
```

#### 4.2 Conversion status handling

```javascript
// docling-serve returns status: success | partial_success | skipped | failure
switch (result.status) {
  case "success":
    // All good
    break;
  case "partial_success":
    showToast(`Warning: Some content could not be extracted from ${filename}`);
    break;
  case "skipped":
    throw new Error(`Document was skipped — unsupported format or empty`);
  case "failure":
    throw new Error(
      `Conversion failed: ${result.errors?.join(", ") || "Unknown error"}`,
    );
}
```

#### 4.3 Output size management

| Scenario             | Max Output     | Behavior                             |
| -------------------- | -------------- | ------------------------------------ |
| Chat/Explain         | 100KB markdown | Truncate with warning                |
| Review mode          | 50KB           | Truncate (review needs focused code) |
| Security scan        | 100KB          | Truncate with warning                |
| Builder load         | 20KB           | Truncate (form fields have limits)   |
| File Browser preview | 500KB          | Truncate for display                 |

Server-side truncation with configurable limit.

#### 4.4 Rate limiting

- 10 conversions per minute per IP (prevents abuse / accidental queue flooding)
- Queue indicator if rate limited

---

### Phase 5: Testing & Documentation

#### 5.1 Unit tests (`tests/unit/docling-client.test.js`)

```javascript
// Test: checkConnection — success and failure
// Test: convertDocument — valid PDF, invalid format, timeout, server offline
// Test: Response parsing — success, partial_success, failure statuses
// Test: API key header inclusion
// Test: File size rejection
// Test: Base64 encoding/decoding roundtrip
```

#### 5.2 Integration tests

```javascript
// Test: POST /api/convert-document — happy path (mock docling-serve)
// Test: POST /api/convert-document — docling offline → 503 with setup hint
// Test: POST /api/convert-document — oversized file → 413
// Test: POST /api/convert-document — unsupported extension → 400
// Test: GET /api/docling/health — connected and disconnected
// Test: Config save/load roundtrip for docling settings
```

#### 5.3 Manual testing checklist

- [ ] Settings: Docling URL field renders, test connection works
- [ ] Settings: Toggle enable/disable hides/shows config
- [ ] Settings: API key field masks input
- [ ] Chat: Upload PDF → converts → attaches as text
- [ ] Chat: Upload PPTX → converts → attaches as text
- [ ] Chat: Upload DOCX → converts → attaches as text
- [ ] Chat: Upload PDF with docling offline → helpful error message
- [ ] Chat: Upload 100-page PDF → truncation warning shown
- [ ] Chat: Drag-and-drop PDF works
- [ ] Review: Upload PDF → code extracted for review
- [ ] Security: Upload PDF → content scanned
- [ ] File Browser: PDF files appear in tree with document icon
- [ ] File Browser: Click PDF → converts and displays
- [ ] File Browser: Quick Attach PDF → converts and attaches
- [ ] Conversion loading spinner shows during conversion
- [ ] Rate limiting: 11th conversion in 1 minute → 429 error

#### 5.4 Documentation updates

- CLAUDE.md: Add docling to tech stack, add lib/docling-client.js to project structure
- APPSETUPNOTES.md: Already updated (#17)
- README.md: Add document conversion feature section
- Settings tooltip: Inline setup instructions

---

## File Change Summary

| File                                | Change Type | Description                                                                                                                  |
| ----------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `lib/config.js`                     | MODIFY      | Add `docling` nested default                                                                                                 |
| `lib/docling-client.js`             | CREATE      | API wrapper (checkConnection, convertDocument, async helpers)                                                                |
| `lib/file-browser.js`               | MODIFY      | Add DOCUMENT_EXTENSIONS, isConvertibleDocument, update buildFileTree                                                         |
| `server.js`                         | MODIFY      | Add /api/convert-document, /api/docling/health, /api/files/read-raw, update POST /api/config, update sanitizeConfigForClient |
| `src/lib/document-processor.js`     | CREATE      | Client-side conversion helper (isConvertibleDocument, convertDocument, getDocumentAcceptString)                              |
| `src/App.jsx`                       | MODIFY      | Inject conversion into handleFileUpload/handleDrop, add doclingAvailable state, add loading indicator                        |
| `src/components/SettingsPanel.jsx`  | MODIFY      | Add Docling section (URL, test, API key, OCR toggle, enable/disable)                                                         |
| `src/components/ReviewPanel.jsx`    | MODIFY      | Update file upload to handle documents                                                                                       |
| `src/components/SecurityPanel.jsx`  | MODIFY      | Update file upload to handle documents                                                                                       |
| `src/components/FileBrowser.jsx`    | MODIFY      | Show document files, handle convert-on-click                                                                                 |
| `tests/unit/docling-client.test.js` | CREATE      | Unit tests for docling-client                                                                                                |

**New dependencies:** None (uses Node.js native fetch, FormData, Blob)

---

## Risk Mitigation

| Risk                                        | Mitigation                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| User doesn't have docling installed         | Clear setup instructions in Settings, graceful error with install command |
| Large PDF crashes browser (base64 encoding) | Client-side size check before reading (maxFileSizeMB from config)         |
| Conversion takes too long                   | Loading indicator + configurable timeout + async fallback                 |
| Converted text too large for AI             | Server-side truncation with per-mode limits                               |
| macOS port conflict                         | Default to 5002, document in APPSETUPNOTES                                |
| API changes in future docling versions      | Isolate all calls in docling-client.js (single point of change)           |
| XSS in converted markdown                   | Existing markdown sanitization in MarkdownContent handles this            |

---

## Implementation Order

1. **lib/config.js** + **lib/docling-client.js** (backend foundation, independently testable)
2. **server.js** endpoints (convert, health, config updates)
3. **SettingsPanel.jsx** (user can configure + test connection)
4. **src/lib/document-processor.js** (client-side helper)
5. **App.jsx** upload flow (core feature working in Chat)
6. **ReviewPanel.jsx** + **SecurityPanel.jsx** (extend to other modes)
7. **FileBrowser.jsx** + **/api/files/read-raw** (browse + convert from tree)
8. **Tests** + **documentation**
