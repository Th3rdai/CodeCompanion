/**
 * Office file generator — creates DOCX, XLSX, and PPTX from structured content.
 *
 * Input: markdown-like text from the AI or user.
 * Output: Buffer of the requested Office format.
 *
 * Used by POST /api/generate-office to let the AI produce downloadable
 * Office documents from its responses.
 */

const path = require('path');

// ── DOCX generation ──────────────────────────────────

async function generateDocx(content, options = {}) {
  const docx = require('docx');
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;

  const lines = content.split('\n');
  const children = [];

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Headings
    if (trimmed.startsWith('# ')) {
      children.push(new Paragraph({
        text: trimmed.slice(2),
        heading: HeadingLevel.HEADING_1,
      }));
    } else if (trimmed.startsWith('## ')) {
      children.push(new Paragraph({
        text: trimmed.slice(3),
        heading: HeadingLevel.HEADING_2,
      }));
    } else if (trimmed.startsWith('### ')) {
      children.push(new Paragraph({
        text: trimmed.slice(4),
        heading: HeadingLevel.HEADING_3,
      }));
    } else if (trimmed.startsWith('#### ')) {
      children.push(new Paragraph({
        text: trimmed.slice(5),
        heading: HeadingLevel.HEADING_4,
      }));
    }
    // Bullet lists
    else if (/^[-*] /.test(trimmed)) {
      children.push(new Paragraph({
        text: trimmed.slice(2),
        bullet: { level: 0 },
      }));
    } else if (/^  [-*] /.test(trimmed)) {
      children.push(new Paragraph({
        text: trimmed.slice(4),
        bullet: { level: 1 },
      }));
    }
    // Numbered lists
    else if (/^\d+\.\s/.test(trimmed)) {
      children.push(new Paragraph({
        text: trimmed.replace(/^\d+\.\s/, ''),
        numbering: { reference: 'default-numbering', level: 0 },
      }));
    }
    // Horizontal rule
    else if (/^---+$/.test(trimmed)) {
      children.push(new Paragraph({
        text: '',
        border: { bottom: { color: '999999', size: 1, style: 'single' } },
      }));
    }
    // Empty line
    else if (trimmed === '') {
      children.push(new Paragraph({ text: '' }));
    }
    // Bold/italic inline formatting
    else {
      const runs = parseInlineFormatting(trimmed);
      children.push(new Paragraph({ children: runs }));
    }
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.START,
        }],
      }],
    },
    sections: [{
      properties: {},
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

/** Parse **bold**, *italic*, and `code` from a text line into TextRuns. */
function parseInlineFormatting(text) {
  const docx = require('docx');
  const { TextRun } = docx;
  const runs = [];
  // Regex: **bold**, *italic*, `code`, or plain text
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|([^*`]+))/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    if (match[2]) {
      runs.push(new TextRun({ text: match[2], bold: true }));
    } else if (match[3]) {
      runs.push(new TextRun({ text: match[3], italics: true }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], font: 'Courier New', size: 20 }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5] }));
    }
  }
  if (runs.length === 0) {
    runs.push(new TextRun({ text }));
  }
  return runs;
}

// ── XLSX generation ──────────────────────────────────

async function generateXlsx(content, options = {}) {
  const XLSX = require('xlsx');
  const wb = XLSX.utils.book_new();

  // Try to parse markdown tables from content
  const sheets = parseMarkdownTables(content);

  if (sheets.length === 0) {
    // No tables found — put the entire text into a single cell per line
    const rows = content.split('\n').map(line => [line]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  } else {
    for (const sheet of sheets) {
      const ws = XLSX.utils.aoa_to_sheet(sheet.rows);
      // Auto-size columns
      const colWidths = [];
      for (const row of sheet.rows) {
        row.forEach((cell, i) => {
          const len = String(cell || '').length;
          colWidths[i] = Math.max(colWidths[i] || 8, Math.min(len + 2, 50));
        });
      }
      ws['!cols'] = colWidths.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31)); // Excel 31-char limit
    }
  }

  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

/** Extract markdown tables into { name, rows[][] } objects. */
function parseMarkdownTables(content) {
  const lines = content.split('\n');
  const sheets = [];
  let currentName = 'Sheet1';
  let headerRow = null;
  let dataRows = [];
  let sheetIndex = 1;

  function flushTable() {
    if (headerRow) {
      sheets.push({ name: currentName, rows: [headerRow, ...dataRows] });
      headerRow = null;
      dataRows = [];
      sheetIndex++;
      currentName = `Sheet${sheetIndex}`;
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Heading before a table = sheet name
    if (/^#{1,4}\s/.test(trimmed)) {
      flushTable();
      currentName = trimmed.replace(/^#+\s*/, '').trim();
      continue;
    }

    // Table separator row (|---|---|)
    if (/^\|[\s-:|]+\|$/.test(trimmed)) {
      continue; // skip separator
    }

    // Table data row
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed
        .slice(1, -1)
        .split('|')
        .map(c => c.trim().replace(/\\[|]/g, '|'));

      if (!headerRow) {
        headerRow = cells;
      } else {
        dataRows.push(cells);
      }
      continue;
    }

    // Non-table line — flush any pending table
    if (headerRow && trimmed !== '') {
      flushTable();
    }
  }

  flushTable(); // flush final table
  return sheets;
}

// ── PPTX generation ──────────────────────────────────

async function generatePptx(content, options = {}) {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = options.author || 'Code Companion';

  // Parse content into slides — split on H1/H2 headings or ---
  const slides = parseSlides(content);

  for (const slideData of slides) {
    const slide = pptx.addSlide();

    // Background
    slide.background = { color: '0F172A' };

    if (slideData.title) {
      slide.addText(slideData.title, {
        x: 0.5, y: 0.3, w: '90%', h: 1,
        fontSize: 28, bold: true, color: 'E2E8F0',
        fontFace: 'Arial',
      });
    }

    if (slideData.body.length > 0) {
      const bodyItems = slideData.body.map(item => {
        const opts = {
          fontSize: 16,
          color: 'CBD5E1',
          fontFace: 'Arial',
          breakType: 'break',
        };
        if (item.bullet) {
          opts.bullet = true;
          opts.indentLevel = item.indent || 0;
        }
        if (item.bold) opts.bold = true;
        return { text: item.text, options: opts };
      });

      slide.addText(bodyItems, {
        x: 0.5, y: 1.5, w: '90%', h: 5,
        valign: 'top',
      });
    }
  }

  // Ensure at least one slide
  if (slides.length === 0) {
    const slide = pptx.addSlide();
    slide.background = { color: '0F172A' };
    slide.addText(content.slice(0, 500), {
      x: 0.5, y: 0.5, w: '90%', h: 6,
      fontSize: 14, color: 'CBD5E1', fontFace: 'Arial',
    });
  }

  return pptx.write({ outputType: 'nodebuffer' });
}

/** Split markdown into slide objects: { title, body: [{ text, bullet, bold, indent }] } */
function parseSlides(content) {
  const lines = content.split('\n');
  const slides = [];
  let current = null;

  function flush() {
    if (current) slides.push(current);
    current = null;
  }

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // H1 or H2 = new slide
    if (/^#{1,2}\s/.test(trimmed)) {
      flush();
      current = {
        title: trimmed.replace(/^#+\s*/, ''),
        body: [],
      };
      continue;
    }

    // --- = slide break
    if (/^---+$/.test(trimmed)) {
      flush();
      continue;
    }

    if (!current) {
      current = { title: '', body: [] };
    }

    // Skip empty lines at the start of a slide body
    if (trimmed === '' && current.body.length === 0) continue;

    // Bullet
    if (/^[-*] /.test(trimmed)) {
      current.body.push({ text: trimmed.slice(2), bullet: true, indent: 0 });
    } else if (/^  [-*] /.test(trimmed)) {
      current.body.push({ text: trimmed.slice(4), bullet: true, indent: 1 });
    }
    // Numbered list
    else if (/^\d+\.\s/.test(trimmed)) {
      current.body.push({ text: trimmed.replace(/^\d+\.\s/, ''), bullet: true, indent: 0 });
    }
    // Bold heading (### or ####)
    else if (/^#{3,4}\s/.test(trimmed)) {
      current.body.push({ text: trimmed.replace(/^#+\s*/, ''), bold: true });
    }
    // Regular text
    else if (trimmed !== '') {
      current.body.push({ text: trimmed.replace(/\*\*(.+?)\*\*/g, '$1') });
    }
  }

  flush();
  return slides;
}

// ── Dispatcher ───────────────────────────────────────

const SUPPORTED_FORMATS = new Set(['.docx', '.xlsx', '.pptx']);

async function generateOfficeFile(content, filename, options = {}) {
  const ext = path.extname(filename || '').toLowerCase();
  const start = Date.now();

  let buffer;
  switch (ext) {
    case '.docx': buffer = await generateDocx(content, options); break;
    case '.xlsx': buffer = await generateXlsx(content, options); break;
    case '.pptx': buffer = await generatePptx(content, options); break;
    default: throw new Error(`Unsupported output format: ${ext}. Use .docx, .xlsx, or .pptx`);
  }

  return {
    buffer,
    filename,
    format: ext,
    size: buffer.length,
    processingTime: (Date.now() - start) / 1000,
  };
}

module.exports = { generateOfficeFile, SUPPORTED_FORMATS };
