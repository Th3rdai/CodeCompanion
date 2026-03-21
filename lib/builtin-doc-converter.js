/**
 * Built-in document converter — lightweight fallback when Docling is unavailable.
 *
 * Supports PDF (.pdf), Word (.docx), and Excel (.xlsx / .xls).
 * Returns the same { markdown, status, processingTime, errors } shape as
 * lib/docling-client.js so the two converters are interchangeable at the
 * call-site in server.js.
 */

const path = require('path');

const BUILTIN_SUPPORTED = new Set(['.pdf', '.docx', '.xlsx', '.xls']);

/** Returns true when the built-in converter can handle `filename`. */
function canConvertBuiltin(filename) {
  const ext = path.extname(filename || '').toLowerCase();
  return BUILTIN_SUPPORTED.has(ext);
}

// ── PDF ──────────────────────────────────────────────

async function convertPdf(buffer, filename) {
  const pdfParse = require('pdf-parse');
  const start = Date.now();
  const data = await pdfParse(buffer);
  const text = (data.text || '').trim();
  const errors = [];

  let markdown;
  if (text.length < 20 && data.numpages > 0) {
    errors.push('PDF appears to be scanned/image-based; install Docling for OCR support.');
    markdown = text || `_(No extractable text in ${data.numpages}-page PDF. Docling with OCR is required for scanned documents.)_`;
  } else {
    markdown = text;
  }

  return {
    markdown,
    status: errors.length ? 'partial' : 'success',
    processingTime: (Date.now() - start) / 1000,
    errors,
  };
}

// ── DOCX ─────────────────────────────────────────────

async function convertDocx(buffer, filename) {
  const mammoth = require('mammoth');
  const start = Date.now();
  const errors = [];

  let markdown;
  try {
    const result = await mammoth.convertToMarkdown({ buffer });
    markdown = (result.value || '').trim();
    if (result.messages) {
      for (const m of result.messages) {
        if (m.type === 'warning') errors.push(m.message);
      }
    }
  } catch {
    // Markdown conversion failed — fall back to raw text extraction
    const raw = await mammoth.extractRawText({ buffer });
    markdown = (raw.value || '').trim();
    errors.push('Markdown conversion failed; extracted raw text instead.');
  }

  return {
    markdown: markdown || '_(Empty document)_',
    status: errors.length ? 'partial' : 'success',
    processingTime: (Date.now() - start) / 1000,
    errors,
  };
}

// ── XLSX / XLS ───────────────────────────────────────

function escapeCell(val) {
  if (val == null || val === '') return '';
  return String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

async function convertXlsx(buffer, filename) {
  const XLSX = require('xlsx');
  const start = Date.now();
  const errors = [];
  const MAX_OUTPUT = 2 * 1024 * 1024; // 2 MB safety limit

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const parts = [];

  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (rows.length === 0) continue;

    if (workbook.SheetNames.length > 1) {
      parts.push(`## Sheet: ${name}\n`);
    }

    const header = rows[0].map(escapeCell);
    parts.push('| ' + header.join(' | ') + ' |');
    parts.push('|' + header.map(() => '---').join('|') + '|');

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i].map(escapeCell);
      // pad to header width
      while (row.length < header.length) row.push('');
      parts.push('| ' + row.join(' | ') + ' |');
    }
    parts.push('');
  }

  let markdown = parts.join('\n').trim();
  let truncated = false;
  if (markdown.length > MAX_OUTPUT) {
    markdown = markdown.slice(0, MAX_OUTPUT) + '\n\n_(Output truncated — spreadsheet too large)_';
    truncated = true;
    errors.push('Output truncated to 2 MB.');
  }

  return {
    markdown: markdown || '_(Empty spreadsheet)_',
    status: errors.length ? 'partial' : 'success',
    processingTime: (Date.now() - start) / 1000,
    errors,
    truncated,
  };
}

// ── Dispatcher ───────────────────────────────────────

async function convertBuiltin(buffer, filename) {
  const ext = path.extname(filename || '').toLowerCase();
  switch (ext) {
    case '.pdf':  return convertPdf(buffer, filename);
    case '.docx': return convertDocx(buffer, filename);
    case '.xlsx':
    case '.xls':  return convertXlsx(buffer, filename);
    default:
      throw new Error(`Built-in converter does not support ${ext} files`);
  }
}

module.exports = { canConvertBuiltin, convertBuiltin, BUILTIN_SUPPORTED };
