/**
 * Parse markdown for Agent Designer "Load from file".
 * @see docs/BUILDER-MARKDOWN-LOAD.md
 */

import {
  extractAtxH1Title,
  parseYamlScalarField,
  splitMarkdownH2Sections,
  splitYamlFrontmatter,
  stripLeadingAtxH1FromBody,
  stripLeadingAtxH1FromPreamble,
  parseH2SectionChunk,
} from "./builder-markdown-standards.js";

function isToolsSectionHeader(header) {
  const h = header.trim().toLowerCase();
  return /^tools\b/.test(h) || /^tooling\b/.test(h);
}

function isInstructionsSectionHeader(header) {
  return /\binstructions?\b/.test(header.trim().toLowerCase());
}

function isWorkflowSectionHeader(header) {
  return /\bworkflow\b/.test(header.trim().toLowerCase());
}

function isGuardrailsSectionHeader(header) {
  const h = header.trim().toLowerCase();
  return /\bguardrail\b/.test(h) || /\bsafety\b/.test(h);
}

function isPurposeSectionHeader(header) {
  const h = header.trim().toLowerCase();
  return /^purpose\b/.test(h) || /\bagents?\s+purpose\b/.test(h);
}

/**
 * Normalize tool list lines to "name — description" (matches save format loosely).
 * Accepts `- **name**: desc`, `- name — desc`, `- name - desc`, or plain lines.
 */
function normalizeToolsBody(sectionBody) {
  return sectionBody
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const l = line.trim();
      const bold = l.match(/^[-*]\s*\*\*(.+?)\*\*:\s*(.+)$/);
      if (bold) return `${bold[1].trim()} — ${bold[2].trim()}`;
      const em = l.match(/^[-*]\s*(.+?)\s+—\s*(.+)$/);
      if (em) return `${em[1].trim()} — ${em[2].trim()}`;
      const hy = l.match(/^[-*]\s*(.+?)\s+-\s+(.+)$/);
      if (hy) return `${hy[1].trim()} — ${hy[2].trim()}`;
      return l.replace(/^[-*]\s*/, "");
    })
    .join("\n");
}

export function parseAgenticLoaded(content) {
  const result = {
    agentName: "",
    purpose: "",
    tools: "",
    instructions: "",
    workflow: "",
    guardrails: "",
  };
  if (!content || typeof content !== "string") return result;

  const {
    hasFrontmatter,
    frontmatter: fm,
    body: bodyRaw,
  } = splitYamlFrontmatter(content);
  const body = bodyRaw;

  if (hasFrontmatter) {
    const desc = parseYamlScalarField(fm, "description");
    if (desc) result.purpose = desc;
  }

  const h1Title = extractAtxH1Title(body);
  if (h1Title) result.agentName = h1Title;
  else if (hasFrontmatter) {
    result.agentName =
      parseYamlScalarField(fm, "name") ||
      parseYamlScalarField(fm, "title") ||
      "";
  }

  const sections = splitMarkdownH2Sections(body);

  const orphanChunks = [];
  let explicitInstructions = null;

  for (let i = 1; i < sections.length; i++) {
    const { headerRaw, headerLower, sectionBody } = parseH2SectionChunk(
      sections[i],
    );

    if (isToolsSectionHeader(headerLower)) {
      result.tools = normalizeToolsBody(sectionBody);
    } else if (isPurposeSectionHeader(headerLower)) {
      result.purpose = sectionBody;
    } else if (isWorkflowSectionHeader(headerLower))
      result.workflow = sectionBody;
    else if (isGuardrailsSectionHeader(headerLower))
      result.guardrails = sectionBody;
    else if (isInstructionsSectionHeader(headerLower)) {
      explicitInstructions = sectionBody;
    } else if (headerRaw || sectionBody) {
      orphanChunks.push(`## ${headerRaw}\n\n${sectionBody}`.trim());
    }
  }

  let preamble = stripLeadingAtxH1FromPreamble(sections[0] || "");
  if (preamble && !(result.purpose || "").trim()) {
    result.purpose = preamble;
    preamble = "";
  }

  const instructionParts = [];
  if (preamble) instructionParts.push(preamble);
  for (const c of orphanChunks) instructionParts.push(c);
  if (explicitInstructions !== null)
    instructionParts.push(explicitInstructions);

  if (instructionParts.length) {
    result.instructions = instructionParts.join("\n\n").trim();
  } else if (sections.length <= 1) {
    const afterHeading = stripLeadingAtxH1FromBody(body);
    if (afterHeading) result.instructions = afterHeading;
  }

  return result;
}
