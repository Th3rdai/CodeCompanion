/**
 * Parse markdown for Skill Builder "Load from file" (SKILL.md-style).
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

function isInputPatternHeader(header) {
  const h = header.trim().toLowerCase();
  return h.includes("input") && h.includes("pattern");
}

function isOutputFormatHeader(header) {
  const h = header.trim().toLowerCase();
  return h.includes("output") && h.includes("format");
}

function isExampleUsageHeader(header) {
  const h = header.trim().toLowerCase();
  return h.includes("example");
}

function isInstructionsHeader(header) {
  const h = header.trim().toLowerCase();
  return /\binstructions?\b/.test(h);
}

export function parseSkillzLoaded(content) {
  const result = {
    skillName: "",
    description: "",
    instructions: "",
    inputPattern: "",
    outputFormat: "",
    exampleUsage: "",
  };
  if (!content || typeof content !== "string") return result;

  const {
    hasFrontmatter,
    frontmatter: fm,
    body: bodyRaw,
  } = splitYamlFrontmatter(content);
  let body = bodyRaw;

  if (hasFrontmatter) {
    const desc = parseYamlScalarField(fm, "description");
    if (desc) result.description = desc;
    const name = parseYamlScalarField(fm, "name");
    if (name) result.skillName = name;
  }

  const h1Title = extractAtxH1Title(body);
  if (h1Title) result.skillName = (result.skillName || h1Title).trim();

  const sections = splitMarkdownH2Sections(body);

  const orphanInstructionChunks = [];
  let explicitInstructions = null;

  for (let i = 1; i < sections.length; i++) {
    const { headerRaw, headerLower, sectionBody } = parseH2SectionChunk(
      sections[i],
    );

    if (isInputPatternHeader(headerLower)) result.inputPattern = sectionBody;
    else if (isOutputFormatHeader(headerLower))
      result.outputFormat = sectionBody;
    else if (isExampleUsageHeader(headerLower))
      result.exampleUsage = sectionBody;
    else if (isInstructionsHeader(headerLower)) {
      explicitInstructions = sectionBody;
    } else if (headerRaw || sectionBody) {
      orphanInstructionChunks.push(`## ${headerRaw}\n\n${sectionBody}`.trim());
    }
  }

  let preamble = stripLeadingAtxH1FromPreamble(sections[0] || "");

  if (sections.length > 1) {
    const hasStructuredOther =
      Boolean(result.inputPattern) ||
      Boolean(result.outputFormat) ||
      Boolean(result.exampleUsage);
    if (
      !result.description &&
      preamble &&
      (explicitInstructions !== null ||
        orphanInstructionChunks.length > 0 ||
        hasStructuredOther)
    ) {
      result.description = preamble;
      preamble = "";
    }
    const instructionParts = [];
    if (preamble) instructionParts.push(preamble);
    for (const c of orphanInstructionChunks) instructionParts.push(c);
    if (explicitInstructions !== null)
      instructionParts.push(explicitInstructions);
    if (instructionParts.length) {
      result.instructions = instructionParts.join("\n\n").trim();
    }
  } else {
    const afterTitle = stripLeadingAtxH1FromPreamble(sections[0] || "");
    if (afterTitle && !afterTitle.startsWith("## ")) {
      if (!result.description) result.description = afterTitle;
    }
    let afterHeading = stripLeadingAtxH1FromBody(body);
    const afterDescription =
      result.description && afterHeading.startsWith(result.description)
        ? afterHeading.slice(result.description.length).trim()
        : afterHeading;
    if (afterDescription) result.instructions = afterDescription;
  }

  return result;
}
