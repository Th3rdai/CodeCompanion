/**
 * Render a markdown file to PDF using marked + Playwright (Chromium).
 * Usage: node scripts/export-md-to-pdf.cjs <input.md> [output.pdf]
 */
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { marked } = require("marked");

async function main() {
  const inArg = process.argv[2] || "docs/RELEASES-AND-UPDATES.md";
  const outArg =
    process.argv[3] ||
    path.join(
      path.dirname(path.resolve(inArg)),
      path.basename(inArg, path.extname(inArg)) + ".pdf",
    );

  const mdPath = path.resolve(inArg);
  const outPath = path.resolve(outArg);

  if (!fs.existsSync(mdPath)) {
    console.error("Not found:", mdPath);
    process.exit(1);
  }

  const md = fs.readFileSync(mdPath, "utf8");
  const body = marked.parse(md);
  const titleMatch = md.match(/^#\s+(.+)$/m);
  const title = titleMatch
    ? titleMatch[1].trim()
    : path.basename(mdPath, ".md");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 18mm 16mm; }
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 11pt; line-height: 1.45; color: #111; }
  h1 { font-size: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 0.3em; }
  h2 { font-size: 14pt; margin-top: 1.2em; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.92em; }
  code { background: #f4f4f6; padding: 0.1em 0.35em; border-radius: 3px; }
  pre { background: #f6f6f8; padding: 0.75em 1em; border-radius: 4px; overflow-x: auto; white-space: pre-wrap; word-break: break-word; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 0.75em 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 0.35em 0.5em; text-align: left; vertical-align: top; }
  th { background: #f0f0f2; }
  a { color: #0b57d0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 1.2em 0; }
  ul { padding-left: 1.4em; }
</style>
</head>
<body>${body}</body>
</html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "load" });
  await page.pdf({
    path: outPath,
    format: "Letter",
    printBackground: true,
    margin: { top: "0.55in", bottom: "0.55in", left: "0.6in", right: "0.6in" },
  });
  await browser.close();
  console.log("Wrote", outPath);
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
