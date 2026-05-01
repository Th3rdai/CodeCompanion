/**
 * Parse Security remediation ZIP sources (AI output + multi-file originals).
 * CRLF-safe delimiters — see docs/BUILDER-MARKDOWN-LOAD.md (related robustness).
 */

/**
 * @param {string} filesSection
 * @returns {{ path: string, content: string }[]}
 */
export function parseRemediationFileBlocks(filesSection) {
  if (!filesSection || typeof filesSection !== "string") return [];
  const re = /---FILE:\s*(.+?)---\r?\n([\s\S]*?)---END_FILE---/g;
  const out = [];
  let m;
  while ((m = re.exec(filesSection)) !== null) {
    out.push({ path: m[1].trim(), content: m[2].trim() });
  }
  return out;
}

/**
 * @param {string} markdown
 * @returns {{ path: string, content: string }[]}
 */
export function parseMarkdownCodeFences(markdown) {
  if (!markdown || typeof markdown !== "string") return [];
  const re = /```[\w]*\r?\n([\s\S]*?)```/g;
  const out = [];
  let m;
  while ((m = re.exec(markdown)) !== null) {
    out.push({ path: "", content: m[1].trim() });
  }
  return out;
}

/**
 * Original multi-file paste format: "── File: path ──\\ncontent..."
 * @param {string} code
 * @returns {{ path: string, content: string }[] | null} null if not multi-file
 */
export function parseOriginalMultiFileBlocks(code) {
  if (!code || typeof code !== "string" || !code.includes("── File: "))
    return null;
  const blocks = code.split(/── File: /);
  const out = [];
  for (const block of blocks) {
    if (!block.trim()) continue;
    const nl = block.search(/\r?\n/);
    if (nl === -1) continue;
    const path = block
      .slice(0, nl)
      .replace(/ ──$/, "")
      .trim()
      .replace(/\r$/, "");
    const content = block.slice(nl + 1).trim();
    if (path) out.push({ path, content });
  }
  return out.length ? out : null;
}
