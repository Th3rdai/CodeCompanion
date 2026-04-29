const fs = require("fs");
const path = require("path");

const VALIDATE_PATH_CANDIDATES = [
  "validate.md",
  ".claude/commands/validate.md",
  ".cursor/prompts/validate.md",
  ".github/prompts/validate.md",
  ".opencode/commands/validate.md",
];

const MAX_VALIDATE_FILE_BYTES = 64 * 1024;
const MAX_VALIDATE_CONTEXT_CHARS = 4000;

function isSameOrSubpath(basePath, targetPath) {
  const base = path.resolve(basePath);
  const target = path.resolve(targetPath);
  const rel = path.relative(base, target);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function toPosixPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractValidationCommands(markdown) {
  const lines = String(markdown || "").split(/\r?\n/);
  const phaseCommands = [];
  const seenCommands = new Set();

  let currentPhase = null;
  for (const line of lines) {
    const phaseMatch = line.match(/^##\s+Phase\s+(\d+):\s*(.+)$/i);
    if (phaseMatch) {
      currentPhase = {
        phaseNumber: Number(phaseMatch[1]),
        phaseTitle: normalizeWhitespace(phaseMatch[2]),
      };
      continue;
    }

    if (!currentPhase) continue;
    const commandMatch = line.match(/`([^`]+)`/);
    if (!commandMatch) continue;
    const command = normalizeWhitespace(commandMatch[1]);
    if (!command || seenCommands.has(command)) continue;

    seenCommands.add(command);
    phaseCommands.push({
      phaseNumber: currentPhase.phaseNumber,
      phaseTitle: currentPhase.phaseTitle,
      command,
    });
  }

  let canonicalCommand = "";
  let inCodeBlock = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) continue;

    const command = normalizeWhitespace(line);
    if (!command || command.startsWith("#")) continue;
    if (!canonicalCommand && command.includes("&&")) {
      canonicalCommand = command;
      break;
    }
  }

  return {
    phaseCommands,
    canonicalCommand,
    commandCount:
      phaseCommands.length +
      (canonicalCommand && !seenCommands.has(canonicalCommand) ? 1 : 0),
  };
}

function buildValidateReviewContext(markdown, sourcePath = "validate.md") {
  const parsed = extractValidationCommands(markdown);
  if (!parsed.phaseCommands.length && !parsed.canonicalCommand) {
    return "";
  }

  const lines = [];
  lines.push(`Validation policy source: ${sourcePath}`);
  lines.push(
    "Use these project-defined validation commands to assess completeness and release readiness.",
  );
  for (const item of parsed.phaseCommands) {
    lines.push(
      `- Phase ${item.phaseNumber} (${item.phaseTitle}): ${item.command}`,
    );
  }
  if (parsed.canonicalCommand) {
    lines.push(`- Canonical all-phases command: ${parsed.canonicalCommand}`);
  }

  return lines.join("\n").slice(0, MAX_VALIDATE_CONTEXT_CHARS).trim();
}

function resolveValidateSearchRoots(projectFolder, searchFrom = "") {
  if (!projectFolder) return null;
  const projectRoot = path.resolve(projectFolder);
  const roots = [];

  const rawSearchFrom = String(searchFrom || "").trim();
  if (rawSearchFrom) {
    const baseTarget = path.isAbsolute(rawSearchFrom)
      ? rawSearchFrom
      : path.join(projectRoot, rawSearchFrom);
    let current = path.resolve(baseTarget);
    if (path.extname(current)) {
      current = path.dirname(current);
    }
    try {
      if (fs.existsSync(current) && fs.statSync(current).isFile()) {
        current = path.dirname(current);
      }
    } catch {
      // Leave current as resolved path if stat fails.
    }

    while (isSameOrSubpath(projectRoot, current)) {
      if (!roots.includes(current)) roots.push(current);
      if (current === projectRoot) break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  if (!roots.includes(projectRoot)) roots.push(projectRoot);
  return roots;
}

function loadValidateReviewContext(projectFolder, options = {}) {
  if (!projectFolder) return null;
  const searchRoots = resolveValidateSearchRoots(
    projectFolder,
    options.searchFrom || "",
  );
  const projectRoot = path.resolve(projectFolder);

  for (const root of searchRoots || []) {
    for (const relativePath of VALIDATE_PATH_CANDIDATES) {
      const absolutePath = path.join(root, relativePath);
      try {
        if (!fs.existsSync(absolutePath)) continue;
        const stats = fs.statSync(absolutePath);
        if (!stats.isFile() || stats.size > MAX_VALIDATE_FILE_BYTES) continue;
        const markdown = fs.readFileSync(absolutePath, "utf8");
        const sourcePath = toPosixPath(
          path.relative(projectRoot, absolutePath),
        );
        const context = buildValidateReviewContext(markdown, sourcePath);
        if (!context) continue;
        return { context, sourcePath };
      } catch {
        // Keep scanning candidate paths on read errors.
      }
    }
  }

  return null;
}

module.exports = {
  VALIDATE_PATH_CANDIDATES,
  extractValidationCommands,
  buildValidateReviewContext,
  resolveValidateSearchRoots,
  loadValidateReviewContext,
};
