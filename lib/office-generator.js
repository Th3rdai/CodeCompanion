/**
 * Office file generator — creates professional DOCX, XLSX, and PPTX
 * from markdown content.
 *
 * Converts all markdown syntax (headings, bold, italic, code, tables,
 * blockquotes, links, lists) into native Office formatting — no raw
 * markdown should appear in the output files.
 */

const path = require('path');

// ── Markdown stripping utilities ─────────────────────

/** Remove ALL markdown syntax, returning plain text. */
function stripMarkdown(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')   // ***bold italic***
    .replace(/\*\*(.+?)\*\*/g, '$1')         // **bold**
    .replace(/\*(.+?)\*/g, '$1')             // *italic*
    .replace(/__(.+?)__/g, '$1')             // __bold__
    .replace(/_(.+?)_/g, '$1')               // _italic_
    .replace(/~~(.+?)~~/g, '$1')             // ~~strikethrough~~
    .replace(/`([^`]+)`/g, '$1')             // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // [text](url)
    .replace(/^>+\s?/gm, '')                 // > blockquote
    .replace(/^#{1,6}\s+/gm, '')             // # headings
    .replace(/^\s*[-*+]\s+/gm, '')           // - bullets
    .replace(/^\s*\d+\.\s+/gm, '')           // 1. numbered
    .replace(/\|/g, '')                       // | table pipes
    .replace(/^[-:|\s]+$/gm, '')             // table separator rows
    .trim();
}

// ── DOCX generation ──────────────────────────────────

async function generateDocx(content, options = {}) {
  const docx = require('docx');
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel,
    AlignmentType, Table, TableRow, TableCell, WidthType,
    BorderStyle, ShadingType, ExternalHyperlink,
  } = docx;

  const lines = content.split('\n');
  const children = [];
  let inCodeBlock = false;
  let codeBlockLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // ── Fenced code blocks ──
    if (/^```/.test(trimmed)) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLines = [];
        i++;
        continue;
      } else {
        // End of code block — emit as monospace paragraph
        inCodeBlock = false;
        const codeText = codeBlockLines.join('\n');
        children.push(new Paragraph({
          spacing: { before: 120, after: 120 },
          shading: { type: ShadingType.SOLID, color: 'F1F5F9' },
          border: {
            top: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            left: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
            right: { style: BorderStyle.SINGLE, size: 1, color: 'CBD5E1' },
          },
          children: [new TextRun({
            text: codeText,
            font: 'Courier New',
            size: 18,
            color: '1E293B',
          })],
        }));
        i++;
        continue;
      }
    }
    if (inCodeBlock) {
      codeBlockLines.push(line);
      i++;
      continue;
    }

    // ── Markdown table → Word table ──
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const tableRows = [];
      while (i < lines.length) {
        const tl = lines[i].trim();
        if (!tl.startsWith('|') || !tl.endsWith('|')) break;
        // Skip separator rows
        if (/^\|[\s-:|]+\|$/.test(tl)) { i++; continue; }
        const cells = tl.slice(1, -1).split('|').map(c => stripMarkdown(c.trim()));
        tableRows.push(cells);
        i++;
      }
      if (tableRows.length > 0) {
        const colCount = Math.max(...tableRows.map(r => r.length));
        const wordRows = tableRows.map((row, rowIdx) =>
          new TableRow({
            children: Array.from({ length: colCount }, (_, ci) =>
              new TableCell({
                shading: rowIdx === 0
                  ? { type: ShadingType.SOLID, color: '1E293B' }
                  : (rowIdx % 2 === 0 ? { type: ShadingType.SOLID, color: 'F8FAFC' } : undefined),
                children: [new Paragraph({
                  children: [new TextRun({
                    text: row[ci] || '',
                    bold: rowIdx === 0,
                    color: rowIdx === 0 ? 'FFFFFF' : '334155',
                    font: 'Arial',
                    size: 20,
                  })],
                })],
              })
            ),
          })
        );
        children.push(new Table({
          rows: wordRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        }));
        children.push(new Paragraph({ text: '' }));
      }
      continue;
    }

    // ── Headings ──
    if (/^#{1,4}\s/.test(trimmed)) {
      const level = trimmed.match(/^(#+)/)[1].length;
      const text = trimmed.replace(/^#+\s*/, '');
      const headingMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
      };
      children.push(new Paragraph({
        children: parseInlineRuns(text),
        heading: headingMap[level] || HeadingLevel.HEADING_4,
        spacing: { before: level <= 2 ? 360 : 240, after: 120 },
      }));
      i++;
      continue;
    }

    // ── Blockquote ──
    if (/^>\s?/.test(trimmed)) {
      const quoteText = trimmed.replace(/^>\s?/, '');
      children.push(new Paragraph({
        children: parseInlineRuns(quoteText),
        indent: { left: 720 },
        border: { left: { style: BorderStyle.SINGLE, size: 6, color: '6366F1' } },
        spacing: { before: 60, after: 60 },
      }));
      i++;
      continue;
    }

    // ── Bullet lists (multi-level) ──
    const bulletMatch = trimmed.match(/^(\s*)([-*+])\s+(.*)/);
    if (bulletMatch) {
      const indent = Math.floor(bulletMatch[1].length / 2);
      const text = bulletMatch[3];
      children.push(new Paragraph({
        children: parseInlineRuns(text),
        bullet: { level: Math.min(indent, 3) },
        spacing: { before: 40, after: 40 },
      }));
      i++;
      continue;
    }

    // ── Numbered lists ──
    const numMatch = trimmed.match(/^(\s*)\d+\.\s+(.*)/);
    if (numMatch) {
      const indent = Math.floor(numMatch[1].length / 2);
      children.push(new Paragraph({
        children: parseInlineRuns(numMatch[2]),
        numbering: { reference: 'default-numbering', level: Math.min(indent, 3) },
        spacing: { before: 40, after: 40 },
      }));
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (/^[-*_]{3,}$/.test(trimmed)) {
      children.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: 'CBD5E1' } },
        spacing: { before: 200, after: 200 },
      }));
      i++;
      continue;
    }

    // ── Empty line ──
    if (trimmed === '') {
      children.push(new Paragraph({ spacing: { before: 60, after: 60 } }));
      i++;
      continue;
    }

    // ── Regular paragraph with inline formatting ──
    children.push(new Paragraph({
      children: parseInlineRuns(trimmed),
      spacing: { before: 60, after: 60 },
    }));
    i++;
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: '1E293B' },
        },
        heading1: {
          run: { font: 'Calibri', size: 36, bold: true, color: '0F172A' },
        },
        heading2: {
          run: { font: 'Calibri', size: 30, bold: true, color: '1E293B' },
        },
        heading3: {
          run: { font: 'Calibri', size: 26, bold: true, color: '334155' },
        },
      },
    },
    numbering: {
      config: [{
        reference: 'default-numbering',
        levels: [0, 1, 2, 3].map(level => ({
          level,
          format: 'decimal',
          text: `%${level + 1}.`,
          alignment: AlignmentType.START,
        })),
      }],
    },
    sections: [{
      properties: {
        page: {
          margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
        },
      },
      children,
    }],
  });

  return Packer.toBuffer(doc);
}

/**
 * Parse inline markdown into an array of TextRuns.
 * Handles: **bold**, *italic*, ***bold italic***, `code`, [link](url),
 * ~~strikethrough~~, and plain text.
 */
function parseInlineRuns(text) {
  const docx = require('docx');
  const { TextRun, ExternalHyperlink } = docx;
  const runs = [];

  // Tokenize: links, bold-italic, bold, italic, strikethrough, code, plain
  const re = /(\[([^\]]+)\]\(([^)]+)\)|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_([^_]+)_|~~(.+?)~~|`([^`]+)`|([^[*_`~]+))/g;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match[2] && match[3]) {
      // [link text](url) — render as blue underlined text
      runs.push(new ExternalHyperlink({
        children: [new TextRun({ text: match[2], color: '4F46E5', underline: {} })],
        link: match[3],
      }));
    } else if (match[4]) {
      runs.push(new TextRun({ text: match[4], bold: true, italics: true }));
    } else if (match[5]) {
      runs.push(new TextRun({ text: match[5], bold: true }));
    } else if (match[6]) {
      runs.push(new TextRun({ text: match[6], bold: true }));
    } else if (match[7]) {
      runs.push(new TextRun({ text: match[7], italics: true }));
    } else if (match[8]) {
      runs.push(new TextRun({ text: match[8], italics: true }));
    } else if (match[9]) {
      runs.push(new TextRun({ text: match[9], strike: true }));
    } else if (match[10]) {
      runs.push(new TextRun({
        text: match[10],
        font: 'Courier New',
        size: 20,
        color: '7C3AED',
        shading: { type: 'solid', color: 'F5F3FF' },
      }));
    } else if (match[11]) {
      runs.push(new TextRun({ text: match[11] }));
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

  const sheets = parseMarkdownTables(content);

  if (sheets.length === 0) {
    // No tables — put clean text into rows (strip markdown)
    const rows = content.split('\n')
      .map(line => [stripMarkdown(line)])
      .filter(r => r[0] !== '');
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  } else {
    for (const sheet of sheets) {
      // Strip markdown from all cell values
      const cleanRows = sheet.rows.map(row =>
        row.map(cell => stripMarkdown(cell))
      );
      const ws = XLSX.utils.aoa_to_sheet(cleanRows);
      const colWidths = [];
      for (const row of cleanRows) {
        row.forEach((cell, i) => {
          const len = String(cell || '').length;
          colWidths[i] = Math.max(colWidths[i] || 8, Math.min(len + 2, 50));
        });
      }
      ws['!cols'] = colWidths.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
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
    if (/^#{1,4}\s/.test(trimmed)) {
      flushTable();
      currentName = trimmed.replace(/^#+\s*/, '').trim();
      continue;
    }
    if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map(c => c.trim().replace(/\\[|]/g, '|'));
      if (!headerRow) headerRow = cells;
      else dataRows.push(cells);
      continue;
    }
    if (headerRow && trimmed !== '') flushTable();
  }
  flushTable();
  return sheets;
}

// ── PPTX generation ──────────────────────────────────

async function generatePptx(content, options = {}) {
  const PptxGenJS = require('pptxgenjs');
  const pptx = new PptxGenJS();

  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = options.author || 'Code Companion';

  const slides = parseSlides(content);

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: '0F172A' };

    // Title bar
    if (slideData.title) {
      slide.addShape('rect', {
        x: 0, y: 0, w: '100%', h: 1.3,
        fill: { color: '1E293B' },
      });
      slide.addText(stripMarkdown(slideData.title), {
        x: 0.6, y: 0.2, w: '88%', h: 0.9,
        fontSize: 28, bold: true, color: 'E2E8F0',
        fontFace: 'Calibri',
      });
    }

    if (slideData.body.length > 0) {
      const bodyItems = slideData.body.map(item => {
        const opts = {
          fontSize: item.isSubheading ? 18 : 15,
          color: item.isSubheading ? 'A5B4FC' : 'CBD5E1',
          fontFace: 'Calibri',
          breakType: 'break',
          bold: item.bold || item.isSubheading,
        };
        if (item.bullet) {
          opts.bullet = { type: 'bullet' };
          opts.indentLevel = item.indent || 0;
        }
        if (item.isCode) {
          opts.fontFace = 'Courier New';
          opts.fontSize = 12;
          opts.color = 'A78BFA';
        }
        return { text: stripMarkdown(item.text), options: opts };
      });

      slide.addText(bodyItems, {
        x: 0.6, y: 1.6, w: '88%', h: 5,
        valign: 'top',
        lineSpacingMultiple: 1.3,
      });
    }

    // Slide number
    slide.addText([{ text: slideData.slideNum || '', options: {
      fontSize: 10, color: '475569', fontFace: 'Calibri',
    }}], {
      x: '90%', y: '92%', w: 1, h: 0.3,
      align: 'right',
    });
  }

  // Ensure at least one slide
  if (slides.length === 0) {
    const slide = pptx.addSlide();
    slide.background = { color: '0F172A' };
    slide.addText(stripMarkdown(content).slice(0, 500), {
      x: 0.6, y: 0.6, w: '88%', h: 6,
      fontSize: 14, color: 'CBD5E1', fontFace: 'Calibri',
    });
  }

  return pptx.write({ outputType: 'nodebuffer' });
}

/** Split markdown into slide objects with clean text. */
function parseSlides(content) {
  const lines = content.split('\n');
  const slides = [];
  let current = null;
  let inCodeBlock = false;
  let slideNum = 0;

  function flush() {
    if (current) {
      slideNum++;
      current.slideNum = String(slideNum);
      slides.push(current);
    }
    current = null;
  }

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Track code blocks
    if (/^```/.test(trimmed)) {
      inCodeBlock = !inCodeBlock;
      if (inCodeBlock && current) {
        current.body.push({ text: '', isCode: true });
      }
      continue;
    }
    if (inCodeBlock) {
      if (current) current.body.push({ text: trimmed, isCode: true });
      continue;
    }

    // H1 or H2 = new slide
    if (/^#{1,2}\s/.test(trimmed)) {
      flush();
      current = { title: trimmed.replace(/^#+\s*/, ''), body: [] };
      continue;
    }

    if (/^---+$/.test(trimmed)) { flush(); continue; }

    if (!current) current = { title: '', body: [] };

    if (trimmed === '' && current.body.length === 0) continue;

    // Sub-headings (### / ####) within a slide
    if (/^#{3,4}\s/.test(trimmed)) {
      current.body.push({ text: trimmed.replace(/^#+\s*/, ''), bold: true, isSubheading: true });
    }
    // Bullets
    else if (/^(\s*)([-*+])\s+(.*)/.test(trimmed)) {
      const m = trimmed.match(/^(\s*)([-*+])\s+(.*)/);
      current.body.push({ text: m[3], bullet: true, indent: Math.floor(m[1].length / 2) });
    }
    // Numbered list
    else if (/^\s*\d+\.\s+/.test(trimmed)) {
      current.body.push({ text: trimmed.replace(/^\s*\d+\.\s+/, ''), bullet: true, indent: 0 });
    }
    // Blockquote
    else if (/^>\s?/.test(trimmed)) {
      current.body.push({ text: trimmed.replace(/^>\s?/, ''), italics: true });
    }
    // Regular text
    else if (trimmed !== '') {
      current.body.push({ text: trimmed });
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
