/**
 * Shared conventions for builder modes "Load from file" / parseLoaded.
 * See docs/BUILDER-MARKDOWN-LOAD.md.
 */

/** Strip UTF-8 BOM so leading `#` still matches. */
export function stripLeadingBom(s) {
  return String(s ?? "").replace(/^\uFEFF/, "");
}

/**
 * Split optional YAML frontmatter from body (CRLF-safe).
 * @returns {{ hasFrontmatter: boolean, frontmatter: string, body: string }}
 */
export function splitYamlFrontmatter(content) {
  const text = stripLeadingBom(content ?? "").trimStart();
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { hasFrontmatter: false, frontmatter: "", body: text };
  return { hasFrontmatter: true, frontmatter: m[1], body: m[2].trim() };
}

/**
 * First ATX H1 in body (`# Title` or `#Title`), not `##`.
 * @returns {string} title or ""
 */
export function extractAtxH1Title(body) {
  const b = String(body ?? "");
  const h1 = b.match(/^#\s+(?!#)(.+)$/m) || b.match(/^#([^#\s\n][^\n]*)$/m);
  return h1 ? h1[1].trim() : "";
}

/**
 * Split body on level-2 headings. Handles CRLF, optional space after `##`,
 * and files that start with `##` (no leading newline).
 * @returns {string[]} sections — [0] is preamble before first `##`, rest are chunks without `##` prefix
 */
export function splitMarkdownH2Sections(body) {
  let b = String(body ?? "");
  if (/^##\s/.test(b)) b = `\n${b}`;
  return b.split(/\r?\n##\s*/);
}

/**
 * First line of a split chunk is the heading; rest is body.
 * @returns {{ headerRaw: string, headerLower: string, sectionBody: string }}
 */
export function parseH2SectionChunk(sectionChunk) {
  const section = String(sectionChunk ?? "");
  const headerEnd = section.indexOf("\n");
  const headerRaw =
    headerEnd === -1 ? section.trim() : section.slice(0, headerEnd).trim();
  const sectionBody = headerEnd === -1 ? "" : section.slice(headerEnd).trim();
  return {
    headerRaw,
    headerLower: headerRaw.toLowerCase(),
    sectionBody,
  };
}

/**
 * Remove first ATX H1 line from preamble (first segment of splitMarkdownH2Sections).
 */
export function stripLeadingAtxH1FromPreamble(preamble) {
  return String(preamble ?? "")
    .replace(/^#\s+(?!#).+\r?\n?/m, "")
    .replace(/^#([^#\s\n][^\n]*)\r?\n?/m, "")
    .trim();
}

/**
 * Remove first H1 from full body (same rules as stripLeadingAtxH1FromPreamble).
 */
export function stripLeadingAtxH1FromBody(body) {
  return String(body ?? "")
    .replace(/^#\s+(?!#).+\r?\n?/m, "")
    .replace(/^#([^#\s\n][^\n]*)\r?\n?/m, "")
    .trim();
}

/**
 * Read a simple YAML string field from a frontmatter block (double-quoted,
 * single-quoted, or unquoted one-line value). Keys are matched per line (`m`).
 */
export function parseYamlScalarField(fm, key) {
  const esc = (s) =>
    String(s).replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\'/g, "'");
  const reDouble = new RegExp(`^${key}:\\s*"((?:\\\\.|[^"])*)"`, "m");
  const d = fm.match(reDouble);
  if (d) return esc(d[1]);

  const reSingle = new RegExp(`^${key}:\\s*'((?:\\\\.|[^'])*)'`, "m");
  const s = fm.match(reSingle);
  if (s) return esc(s[1]);

  const rePlain = new RegExp(`^${key}:\\s*(.+)`, "m");
  const p = fm.match(rePlain);
  if (!p) return "";
  let v = p[1].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  return esc(v);
}
