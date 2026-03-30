/**
 * Office file generator — creates professional DOCX, XLSX, and PPTX
 * from markdown content.
 *
 * Converts all markdown syntax (headings, bold, italic, code, tables,
 * blockquotes, links, lists) into native Office formatting — no raw
 * markdown should appear in the output files.
 */

const path = require("path");

// ── Markdown stripping utilities ─────────────────────

/** Remove ALL markdown syntax, returning plain text. */
function stripMarkdown(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, "$1") // ***bold italic***
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/\*(.+?)\*/g, "$1") // *italic*
    .replace(/__(.+?)__/g, "$1") // __bold__
    .replace(/_(.+?)_/g, "$1") // _italic_
    .replace(/~~(.+?)~~/g, "$1") // ~~strikethrough~~
    .replace(/`([^`]+)`/g, "$1") // `code`
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url)
    .replace(/^>+\s?/gm, "") // > blockquote
    .replace(/^#{1,6}\s+/gm, "") // # headings
    .replace(/^\s*[-*+]\s+/gm, "") // - bullets
    .replace(/^\s*\d+\.\s+/gm, "") // 1. numbered
    .replace(/\|/g, "") // | table pipes
    .replace(/^[-:|\s]+$/gm, "") // table separator rows
    .trim();
}

function escapeXml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── DOCX generation ──────────────────────────────────

async function generateDocx(content, options = {}) {
  const docx = require("docx");
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    Table,
    TableRow,
    TableCell,
    WidthType,
    BorderStyle,
    ShadingType,
    ExternalHyperlink,
  } = docx;

  const lines = content.split("\n");
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
        const codeText = codeBlockLines.join("\n");
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 120 },
            shading: { type: ShadingType.SOLID, color: "F1F5F9" },
            border: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "CBD5E1" },
            },
            children: [
              new TextRun({
                text: codeText,
                font: "Courier New",
                size: 18,
                color: "1E293B",
              }),
            ],
          }),
        );
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
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableRows = [];
      while (i < lines.length) {
        const tl = lines[i].trim();
        if (!tl.startsWith("|") || !tl.endsWith("|")) break;
        // Skip separator rows
        if (/^\|[\s-:|]+\|$/.test(tl)) {
          i++;
          continue;
        }
        const cells = tl
          .slice(1, -1)
          .split("|")
          .map((c) => stripMarkdown(c.trim()));
        tableRows.push(cells);
        i++;
      }
      if (tableRows.length > 0) {
        const colCount = Math.max(...tableRows.map((r) => r.length));
        const wordRows = tableRows.map(
          (row, rowIdx) =>
            new TableRow({
              children: Array.from(
                { length: colCount },
                (_, ci) =>
                  new TableCell({
                    shading:
                      rowIdx === 0
                        ? { type: ShadingType.SOLID, color: "1E293B" }
                        : rowIdx % 2 === 0
                          ? { type: ShadingType.SOLID, color: "F8FAFC" }
                          : undefined,
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: row[ci] || "",
                            bold: rowIdx === 0,
                            color: rowIdx === 0 ? "FFFFFF" : "334155",
                            font: "Arial",
                            size: 20,
                          }),
                        ],
                      }),
                    ],
                  }),
              ),
            }),
        );
        children.push(
          new Table({
            rows: wordRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          }),
        );
        children.push(new Paragraph({ text: "" }));
      }
      continue;
    }

    // ── Headings ──
    if (/^#{1,4}\s/.test(trimmed)) {
      const level = trimmed.match(/^(#+)/)[1].length;
      const text = trimmed.replace(/^#+\s*/, "");
      const headingMap = {
        1: HeadingLevel.HEADING_1,
        2: HeadingLevel.HEADING_2,
        3: HeadingLevel.HEADING_3,
        4: HeadingLevel.HEADING_4,
      };
      children.push(
        new Paragraph({
          children: parseInlineRuns(text),
          heading: headingMap[level] || HeadingLevel.HEADING_4,
          spacing: { before: level <= 2 ? 360 : 240, after: 120 },
        }),
      );
      i++;
      continue;
    }

    // ── Blockquote ──
    if (/^>\s?/.test(trimmed)) {
      const quoteText = trimmed.replace(/^>\s?/, "");
      children.push(
        new Paragraph({
          children: parseInlineRuns(quoteText),
          indent: { left: 720 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 6, color: "6366F1" },
          },
          spacing: { before: 60, after: 60 },
        }),
      );
      i++;
      continue;
    }

    // ── Bullet lists (multi-level) ──
    const bulletMatch = trimmed.match(/^(\s*)([-*+])\s+(.*)/);
    if (bulletMatch) {
      const indent = Math.floor(bulletMatch[1].length / 2);
      const text = bulletMatch[3];
      children.push(
        new Paragraph({
          children: parseInlineRuns(text),
          bullet: { level: Math.min(indent, 3) },
          spacing: { before: 40, after: 40 },
        }),
      );
      i++;
      continue;
    }

    // ── Numbered lists ──
    const numMatch = trimmed.match(/^(\s*)\d+\.\s+(.*)/);
    if (numMatch) {
      const indent = Math.floor(numMatch[1].length / 2);
      children.push(
        new Paragraph({
          children: parseInlineRuns(numMatch[2]),
          numbering: {
            reference: "default-numbering",
            level: Math.min(indent, 3),
          },
          spacing: { before: 40, after: 40 },
        }),
      );
      i++;
      continue;
    }

    // ── Horizontal rule ──
    if (/^[-*_]{3,}$/.test(trimmed)) {
      children.push(
        new Paragraph({
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 2, color: "CBD5E1" },
          },
          spacing: { before: 200, after: 200 },
        }),
      );
      i++;
      continue;
    }

    // ── Empty line ──
    if (trimmed === "") {
      children.push(new Paragraph({ spacing: { before: 60, after: 60 } }));
      i++;
      continue;
    }

    // ── Regular paragraph with inline formatting ──
    children.push(
      new Paragraph({
        children: parseInlineRuns(trimmed),
        spacing: { before: 60, after: 60 },
      }),
    );
    i++;
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22, color: "1E293B" },
        },
        heading1: {
          run: { font: "Calibri", size: 36, bold: true, color: "0F172A" },
        },
        heading2: {
          run: { font: "Calibri", size: 30, bold: true, color: "1E293B" },
        },
        heading3: {
          run: { font: "Calibri", size: 26, bold: true, color: "334155" },
        },
      },
    },
    numbering: {
      config: [
        {
          reference: "default-numbering",
          levels: [0, 1, 2, 3].map((level) => ({
            level,
            format: "decimal",
            text: `%${level + 1}.`,
            alignment: AlignmentType.START,
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

/**
 * Parse inline markdown into an array of TextRuns.
 * Handles: **bold**, *italic*, ***bold italic***, `code`, [link](url),
 * ~~strikethrough~~, and plain text.
 */
function parseInlineRuns(text) {
  const docx = require("docx");
  const { TextRun, ExternalHyperlink } = docx;
  const runs = [];

  // Tokenize: links, bold-italic, bold, italic, strikethrough, code, plain
  const re =
    /(\[([^\]]+)\]\(([^)]+)\)|\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_([^_]+)_|~~(.+?)~~|`([^`]+)`|([^[*_`~]+))/g;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match[2] && match[3]) {
      // [link text](url) — render as blue underlined text
      runs.push(
        new ExternalHyperlink({
          children: [
            new TextRun({ text: match[2], color: "4F46E5", underline: {} }),
          ],
          link: match[3],
        }),
      );
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
      runs.push(
        new TextRun({
          text: match[10],
          font: "Courier New",
          size: 20,
          color: "7C3AED",
          shading: { type: "solid", color: "F5F3FF" },
        }),
      );
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
  const ExcelJS = require("exceljs");
  const wb = new ExcelJS.Workbook();

  const sheets = parseMarkdownTables(content);

  if (sheets.length === 0) {
    const ws = wb.addWorksheet("Sheet1");
    const rows = content
      .split("\n")
      .map((line) => [stripMarkdown(line)])
      .filter((r) => r[0] !== "");
    if (rows.length === 0) {
      ws.addRow([""]);
    } else {
      rows.forEach((r) => ws.addRow(r));
    }
    ws.getColumn(1).width = 80;
  } else {
    for (const sheet of sheets) {
      const cleanRows = sheet.rows.map((row) =>
        row.map((cell) => stripMarkdown(cell)),
      );
      const ws = wb.addWorksheet(sheet.name.slice(0, 31));
      cleanRows.forEach((r) => ws.addRow(r));
      const colWidths = [];
      for (const row of cleanRows) {
        row.forEach((cell, i) => {
          const len = String(cell || "").length;
          colWidths[i] = Math.max(colWidths[i] || 8, Math.min(len + 2, 50));
        });
      }
      colWidths.forEach((w, i) => {
        ws.getColumn(i + 1).width = w;
      });
    }
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Extract markdown tables into { name, rows[][] } objects. */
function parseMarkdownTables(content) {
  const lines = content.split("\n");
  const sheets = [];
  let currentName = "Sheet1";
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
      currentName = trimmed.replace(/^#+\s*/, "").trim();
      continue;
    }
    if (/^\|[\s-:|]+\|$/.test(trimmed)) continue;
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim().replace(/\\[|]/g, "|"));
      if (!headerRow) headerRow = cells;
      else dataRows.push(cells);
      continue;
    }
    if (headerRow && trimmed !== "") flushTable();
  }
  flushTable();
  return sheets;
}

// ── PPTX generation ──────────────────────────────────

async function generatePptx(content, options = {}) {
  const PptxGenJS = require("pptxgenjs");
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = options.author || "Code Companion";

  const slides = parseSlides(content);

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: "0F172A" };

    // Title bar
    if (slideData.title) {
      slide.addShape("rect", {
        x: 0,
        y: 0,
        w: "100%",
        h: 1.3,
        fill: { color: "1E293B" },
      });
      slide.addText(stripMarkdown(slideData.title), {
        x: 0.6,
        y: 0.2,
        w: "88%",
        h: 0.9,
        fontSize: 28,
        bold: true,
        color: "E2E8F0",
        fontFace: "Calibri",
      });
    }

    if (slideData.body.length > 0) {
      const bodyItems = slideData.body.map((item) => {
        const opts = {
          fontSize: item.isSubheading ? 18 : 15,
          color: item.isSubheading ? "A5B4FC" : "CBD5E1",
          fontFace: "Calibri",
          breakType: "break",
          bold: item.bold || item.isSubheading,
        };
        if (item.bullet) {
          opts.bullet = { type: "bullet" };
          opts.indentLevel = item.indent || 0;
        }
        if (item.isCode) {
          opts.fontFace = "Courier New";
          opts.fontSize = 12;
          opts.color = "A78BFA";
        }
        return { text: stripMarkdown(item.text), options: opts };
      });

      slide.addText(bodyItems, {
        x: 0.6,
        y: 1.6,
        w: "88%",
        h: 5,
        valign: "top",
        lineSpacingMultiple: 1.3,
      });
    }

    // Slide number
    slide.addText(
      [
        {
          text: slideData.slideNum || "",
          options: {
            fontSize: 10,
            color: "475569",
            fontFace: "Calibri",
          },
        },
      ],
      {
        x: "90%",
        y: "92%",
        w: 1,
        h: 0.3,
        align: "right",
      },
    );
  }

  // Ensure at least one slide
  if (slides.length === 0) {
    const slide = pptx.addSlide();
    slide.background = { color: "0F172A" };
    slide.addText(stripMarkdown(content).slice(0, 500), {
      x: 0.6,
      y: 0.6,
      w: "88%",
      h: 6,
      fontSize: 14,
      color: "CBD5E1",
      fontFace: "Calibri",
    });
  }

  return pptx.write({ outputType: "nodebuffer" });
}

/** Split markdown into slide objects with clean text. */
function parseSlides(content) {
  const lines = content.split("\n");
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
        current.body.push({ text: "", isCode: true });
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
      current = { title: trimmed.replace(/^#+\s*/, ""), body: [] };
      continue;
    }

    if (/^---+$/.test(trimmed)) {
      flush();
      continue;
    }

    if (!current) current = { title: "", body: [] };

    if (trimmed === "" && current.body.length === 0) continue;

    // Sub-headings (### / ####) within a slide
    if (/^#{3,4}\s/.test(trimmed)) {
      current.body.push({
        text: trimmed.replace(/^#+\s*/, ""),
        bold: true,
        isSubheading: true,
      });
    }
    // Bullets
    else if (/^(\s*)([-*+])\s+(.*)/.test(trimmed)) {
      const m = trimmed.match(/^(\s*)([-*+])\s+(.*)/);
      current.body.push({
        text: m[3],
        bullet: true,
        indent: Math.floor(m[1].length / 2),
      });
    }
    // Numbered list
    else if (/^\s*\d+\.\s+/.test(trimmed)) {
      current.body.push({
        text: trimmed.replace(/^\s*\d+\.\s+/, ""),
        bullet: true,
        indent: 0,
      });
    }
    // Blockquote
    else if (/^>\s?/.test(trimmed)) {
      current.body.push({ text: trimmed.replace(/^>\s?/, ""), italics: true });
    }
    // Regular text
    else if (trimmed !== "") {
      current.body.push({ text: trimmed });
    }
  }
  flush();
  return slides;
}

// ── Dispatcher ───────────────────────────────────────

// ── CSV generation ───────────────────────────────────

async function generateCsv(content, options = {}) {
  const tables = parseMarkdownTables(content);

  let csv;
  if (tables.length > 0) {
    // Use the first table found
    csv = tables[0].rows
      .map((row) =>
        row
          .map((cell) => {
            const clean = stripMarkdown(cell);
            // Quote cells that contain commas, quotes, or newlines
            return /[,"\n]/.test(clean)
              ? `"${clean.replace(/"/g, '""')}"`
              : clean;
          })
          .join(","),
      )
      .join("\n");
  } else {
    // No tables — split lines into single-column CSV
    csv = content
      .split("\n")
      .map((line) => stripMarkdown(line))
      .filter((line) => line !== "")
      .map((line) =>
        /[,"\n]/.test(line) ? `"${line.replace(/"/g, '""')}"` : line,
      )
      .join("\n");
  }

  return Buffer.from(csv, "utf8");
}

// ── PDF generation ───────────────────────────────────

async function generatePdf(content, options = {}) {
  const PDFDocument = require("pdfkit");

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      info: { Title: options.title || "Document", Author: "Code Companion" },
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const lines = content.split("\n");
    let inCodeBlock = false;

    for (const line of lines) {
      const trimmed = line.trimEnd();

      // Code blocks
      if (/^```/.test(trimmed)) {
        inCodeBlock = !inCodeBlock;
        if (inCodeBlock) doc.moveDown(0.3);
        continue;
      }
      if (inCodeBlock) {
        doc
          .font("Courier")
          .fontSize(9)
          .fillColor("#334155")
          .text(line, { indent: 20 });
        continue;
      }

      // Headings
      if (trimmed.startsWith("# ")) {
        doc
          .moveDown(0.5)
          .font("Helvetica-Bold")
          .fontSize(22)
          .fillColor("#0F172A")
          .text(stripMarkdown(trimmed.slice(2)))
          .moveDown(0.3);
      } else if (trimmed.startsWith("## ")) {
        doc
          .moveDown(0.4)
          .font("Helvetica-Bold")
          .fontSize(17)
          .fillColor("#1E293B")
          .text(stripMarkdown(trimmed.slice(3)))
          .moveDown(0.2);
      } else if (trimmed.startsWith("### ")) {
        doc
          .moveDown(0.3)
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#334155")
          .text(stripMarkdown(trimmed.slice(4)))
          .moveDown(0.15);
      } else if (trimmed.startsWith("#### ")) {
        doc
          .moveDown(0.2)
          .font("Helvetica-Bold")
          .fontSize(12)
          .fillColor("#475569")
          .text(stripMarkdown(trimmed.slice(5)))
          .moveDown(0.1);
      }
      // Blockquote
      else if (/^>\s?/.test(trimmed)) {
        doc
          .font("Helvetica-Oblique")
          .fontSize(11)
          .fillColor("#6366F1")
          .text(stripMarkdown(trimmed.replace(/^>\s?/, "")), { indent: 30 });
        doc.font("Helvetica");
      }
      // Bullet
      else if (/^\s*[-*+]\s+/.test(trimmed)) {
        const indent = (trimmed.match(/^(\s*)/)[1].length / 2) * 15;
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor("#1E293B")
          .text(
            "\u2022  " + stripMarkdown(trimmed.replace(/^\s*[-*+]\s+/, "")),
            { indent: 20 + indent },
          );
      }
      // Numbered list
      else if (/^\s*\d+\.\s+/.test(trimmed)) {
        const num = trimmed.match(/^\s*(\d+)\./)[1];
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor("#1E293B")
          .text(
            `${num}.  ` + stripMarkdown(trimmed.replace(/^\s*\d+\.\s+/, "")),
            { indent: 20 },
          );
      }
      // Horizontal rule
      else if (/^[-*_]{3,}$/.test(trimmed)) {
        doc.moveDown(0.5);
        const y = doc.y;
        doc
          .moveTo(72, y)
          .lineTo(doc.page.width - 72, y)
          .strokeColor("#CBD5E1")
          .lineWidth(0.5)
          .stroke();
        doc.moveDown(0.5);
      }
      // Table row (simple rendering)
      else if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        if (/^\|[\s-:|]+\|$/.test(trimmed)) continue; // skip separator
        const cells = trimmed
          .slice(1, -1)
          .split("|")
          .map((c) => stripMarkdown(c.trim()));
        doc
          .font("Helvetica")
          .fontSize(10)
          .fillColor("#1E293B")
          .text(cells.join("    |    "), { indent: 10 });
      }
      // Empty line
      else if (trimmed === "") {
        doc.moveDown(0.3);
      }
      // Regular paragraph
      else {
        doc
          .font("Helvetica")
          .fontSize(11)
          .fillColor("#1E293B")
          .text(stripMarkdown(trimmed));
      }
    }

    doc.end();
  });
}

// ── ODS generation (OpenDocument Spreadsheet ZIP + XML) ─

function buildOdsTableXml(name, rows) {
  const safeName = escapeXml(
    String(name || "Sheet1")
      .replace(/[^\w.\- ]/g, "_")
      .slice(0, 31) || "Sheet1",
  );
  let xml = `<table:table table:name="${safeName}">`;
  for (const row of rows) {
    xml += "<table:table-row>";
    const maxCols = Math.max(1, row.length);
    for (let c = 0; c < maxCols; c++) {
      const cell = row[c] ?? "";
      xml += `<table:table-cell><text:p>${escapeXml(String(cell))}</text:p></table:table-cell>`;
    }
    xml += "</table:table-row>";
  }
  xml += "</table:table>";
  return xml;
}

async function generateOds(content, options = {}) {
  const JSZip = require("jszip");
  const zip = new JSZip();
  const tables = parseMarkdownTables(content);

  let sheetBlocks;
  if (tables.length === 0) {
    const rows = content
      .split("\n")
      .map((l) => [stripMarkdown(l)])
      .filter((r) => r[0] !== "");
    sheetBlocks = [{ name: "Sheet1", rows: rows.length ? rows : [[""]] }];
  } else {
    sheetBlocks = tables.map((t) => ({
      name: t.name.slice(0, 31),
      rows: t.rows.map((row) => row.map((c) => stripMarkdown(c))),
    }));
  }

  const spreadsheetInner = sheetBlocks
    .map((s) => buildOdsTableXml(s.name, s.rows))
    .join("\n");

  zip.file("mimetype", "application/vnd.oasis.opendocument.spreadsheet", {
    compression: "STORE",
  });
  zip.file(
    "META-INF/manifest.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`,
  );
  zip.file(
    "styles.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0">
  <office:styles/>
</office:document-styles>`,
  );
  zip.file(
    "content.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:spreadsheet>
      ${spreadsheetInner}
    </office:spreadsheet>
  </office:body>
</office:document-content>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

// ── ODT generation (simple ZIP-based OpenDocument) ───

async function generateOdt(content, options = {}) {
  const JSZip = require("jszip");
  const zip = new JSZip();

  const clean = stripMarkdown(content);
  const paragraphs = clean
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<text:p text:style-name="Standard">${escapeXml(l)}</text:p>`)
    .join("\n");

  zip.file("mimetype", "application/vnd.oasis.opendocument.text", {
    compression: "STORE",
  });
  zip.file(
    "META-INF/manifest.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`,
  );
  zip.file(
    "styles.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0">
  <office:styles>
    <style:style style:name="Standard" style:family="paragraph">
      <style:paragraph-properties fo:margin-bottom="0.25cm"/>
      <style:text-properties fo:font-size="11pt" style:font-name="Calibri"/>
    </style:style>
  </office:styles>
</office:document-styles>`,
  );
  zip.file(
    "content.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body>
    <office:text>
      ${paragraphs}
    </office:text>
  </office:body>
</office:document-content>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}

// ── Plain text / Markdown / HTML / JSON ──────────────

function generateTxt(content) {
  return Buffer.from(stripMarkdown(content), "utf8");
}

function generateMd(content) {
  return Buffer.from(content, "utf8");
}

function generateHtml(content) {
  const body = content
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (t.startsWith("# ")) return `<h1>${stripMarkdown(t.slice(2))}</h1>`;
      if (t.startsWith("## ")) return `<h2>${stripMarkdown(t.slice(3))}</h2>`;
      if (t.startsWith("### ")) return `<h3>${stripMarkdown(t.slice(4))}</h3>`;
      if (/^[-*+]\s/.test(t)) return `<li>${stripMarkdown(t.slice(2))}</li>`;
      if (t === "") return "";
      return `<p>${stripMarkdown(t)}</p>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Export</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1e293b; line-height: 1.6; }
  h1 { color: #0f172a; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
  h2 { color: #1e293b; margin-top: 1.5em; }
  h3 { color: #334155; }
  li { margin: 4px 0; }
  code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
  blockquote { border-left: 4px solid #6366f1; padding-left: 16px; color: #475569; margin: 16px 0; }
</style></head>
<body>${body}</body></html>`;
  return Buffer.from(html, "utf8");
}

function generateJson(content, options = {}) {
  const obj = {
    title: options.title || "Export",
    date: new Date().toISOString(),
    content,
    messages: options.messages || [],
  };
  return Buffer.from(JSON.stringify(obj, null, 2), "utf8");
}

// ── Dispatcher ───────────────────────────────────────

const SUPPORTED_FORMATS = new Set([
  ".md",
  ".txt",
  ".html",
  ".json",
  ".docx",
  ".xlsx",
  ".csv",
  ".pptx",
  ".pdf",
  ".odt",
  ".ods",
]);

const FORMAT_META = [
  { ext: ".md", label: "Markdown", icon: "📝", group: "Text" },
  { ext: ".txt", label: "Plain Text", icon: "📄", group: "Text" },
  { ext: ".html", label: "HTML", icon: "🌐", group: "Text" },
  { ext: ".json", label: "JSON", icon: "{ }", group: "Text" },
  { ext: ".pdf", label: "PDF", icon: "📕", group: "Document" },
  { ext: ".docx", label: "Word", icon: "📘", group: "Document" },
  { ext: ".odt", label: "OpenDoc Text", icon: "📃", group: "Document" },
  { ext: ".xlsx", label: "Excel", icon: "📗", group: "Spreadsheet" },
  { ext: ".ods", label: "OpenDoc Sheet", icon: "📊", group: "Spreadsheet" },
  { ext: ".csv", label: "CSV", icon: "📋", group: "Spreadsheet" },
  { ext: ".pptx", label: "PowerPoint", icon: "📙", group: "Presentation" },
];

async function generateOfficeFile(content, filename, options = {}) {
  const ext = path.extname(filename || "").toLowerCase();
  const start = Date.now();

  let buffer;
  switch (ext) {
    case ".docx":
      buffer = await generateDocx(content, options);
      break;
    case ".xlsx":
      buffer = await generateXlsx(content, options);
      break;
    case ".pptx":
      buffer = await generatePptx(content, options);
      break;
    case ".csv":
      buffer = await generateCsv(content, options);
      break;
    case ".pdf":
      buffer = await generatePdf(content, options);
      break;
    case ".odt":
      buffer = await generateOdt(content, options);
      break;
    case ".ods":
      buffer = await generateOds(content, options);
      break;
    case ".md":
      buffer = generateMd(content);
      break;
    case ".txt":
      buffer = generateTxt(content);
      break;
    case ".html":
      buffer = generateHtml(content);
      break;
    case ".json":
      buffer = generateJson(content, options);
      break;
    default:
      throw new Error(`Unsupported format: ${ext}`);
  }

  return {
    buffer,
    filename,
    format: ext,
    size: buffer.length,
    processingTime: (Date.now() - start) / 1000,
  };
}

module.exports = { generateOfficeFile, SUPPORTED_FORMATS, FORMAT_META };
