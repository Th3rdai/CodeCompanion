/**
 * Parse markdown from Plan Designer "Load from file" into structured fields.
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

function isGoalSectionHeader(header) {
  const h = header.trim().toLowerCase();
  if (/\bgoal\b/.test(h)) return true;
  if (/\bobjective\b/.test(h)) return true;
  if (/^overview\b/.test(h)) return true;
  if (/\bexecutive\s+overview\b/.test(h)) return true;
  if (/\bproject\s+overview\b/.test(h)) return true;
  return false;
}

function isScopeSectionHeader(header) {
  return /\bscope\b/.test(header.trim().toLowerCase());
}

function isStepsSectionHeader(header) {
  const h = header.trim().toLowerCase();
  if (/\bsteps?\b/.test(h)) return true;
  if (/\bimplementation\s+steps?\b/.test(h)) return true;
  if (/^implementation\b/.test(h)) return true;
  if (/^implementation\s+plan\b/.test(h)) return true;
  if (
    /\bplan\b/.test(h) &&
    /\b(project|phase|roadmap|rollout|execution|delivery|work)\b/.test(h)
  )
    return true;
  return false;
}

function isDepsSectionHeader(header) {
  const h = header.trim().toLowerCase();
  return h.includes("depend") || h.includes("prerequisite");
}

function isTestingSectionHeader(header) {
  const h = header.trim().toLowerCase();
  return (
    /\btest(?:ing)?\b/.test(h) ||
    h.includes("verification") ||
    h.includes("validat")
  );
}

function isRiskSectionHeader(header) {
  const h = header.trim().toLowerCase();
  return (
    h.includes("risk") || h.includes("mitigation") || h.includes("pitfall")
  );
}

export function parsePlannerLoaded(content) {
  const result = {
    planName: "",
    goal: "",
    scope: "",
    steps: "",
    dependencies: "",
    testing: "",
    risks: "",
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
    if (desc) result.goal = desc;
    const title = parseYamlScalarField(fm, "title");
    if (title) result.planName = title;
  }

  const h1Title = extractAtxH1Title(body);
  if (h1Title) result.planName = (result.planName || h1Title).trim();

  const sections = splitMarkdownH2Sections(body);

  const stepsChunks = [];
  let explicitStepsBody = null;

  for (let i = 1; i < sections.length; i++) {
    const { headerRaw, headerLower, sectionBody } = parseH2SectionChunk(
      sections[i],
    );

    if (isGoalSectionHeader(headerLower)) result.goal = sectionBody;
    else if (isScopeSectionHeader(headerLower)) result.scope = sectionBody;
    else if (isStepsSectionHeader(headerLower)) {
      explicitStepsBody = sectionBody;
    } else if (isDepsSectionHeader(headerLower))
      result.dependencies = sectionBody;
    else if (isTestingSectionHeader(headerLower)) result.testing = sectionBody;
    else if (isRiskSectionHeader(headerLower)) result.risks = sectionBody;
    else if (headerRaw || sectionBody) {
      stepsChunks.push(`## ${headerRaw}\n\n${sectionBody}`.trim());
    }
  }

  let preamble = stripLeadingAtxH1FromPreamble(sections[0] || "");

  if (!result.goal && preamble) {
    const gm = preamble.match(
      /(?:^|\n)\s*(?:\*\*)?(?:Goal|Objective)(?:\*\*)?\s*:\s*([\s\S]+)/i,
    );
    if (gm) {
      result.goal = gm[1].trim();
      preamble = (
        preamble.slice(0, gm.index) + preamble.slice(gm.index + gm[0].length)
      ).trim();
    }
  }

  const orderedSteps = [];
  if (preamble) orderedSteps.push(preamble);
  for (const c of stepsChunks) orderedSteps.push(c);
  if (explicitStepsBody) orderedSteps.push(explicitStepsBody);

  if (orderedSteps.length) {
    result.steps = orderedSteps.join("\n\n").trim();
  } else if (sections.length <= 1) {
    let afterHeading = stripLeadingAtxH1FromBody(body);
    if (result.goal) {
      const strip = afterHeading.match(
        /(?:^|\n)\s*(?:\*\*)?(?:Goal|Objective)(?:\*\*)?\s*:\s*[\s\S]+/i,
      );
      if (strip) {
        afterHeading = (
          afterHeading.slice(0, strip.index) +
          afterHeading.slice(strip.index + strip[0].length)
        ).trim();
      }
    }
    if (afterHeading) result.steps = afterHeading;
  }

  return result;
}
