/**
 * Parse markdown for Prompt Builder "Load from file".
 * Matches PromptingPanel.buildContent: YAML frontmatter + body + optional ## Constraints.
 * @see docs/BUILDER-MARKDOWN-LOAD.md
 */

import {
  parseYamlScalarField,
  splitYamlFrontmatter,
  stripLeadingBom,
} from "./builder-markdown-standards.js";

function parseVariablesArray(fm) {
  const varsMatch = fm.match(/variables:\s*\[([\s\S]*?)\]/);
  if (!varsMatch) return [];
  return varsMatch[1]
    .split(",")
    .map((v) => {
      let t = v.trim();
      if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
      else if (t.startsWith("'") && t.endsWith("'")) t = t.slice(1, -1);
      return t;
    })
    .filter(Boolean);
}

function splitConstraintsFromBody(body) {
  const parts = body.split(/\r?\n##\s*Constraints\s*\r?\n/i);
  if (parts.length <= 1) {
    return { content: body.trim(), constraints: "" };
  }
  return {
    content: parts[0].trim(),
    constraints: parts.slice(1).join("\n\n").trim(),
  };
}

export function parsePromptingLoaded(content) {
  const result = {
    content: "",
    purpose: "",
    targetModel: "",
    variables: [],
    constraints: "",
  };
  if (!content || typeof content !== "string") return result;

  const {
    hasFrontmatter,
    frontmatter: fm,
    body,
  } = splitYamlFrontmatter(content);

  if (hasFrontmatter) {
    result.purpose = parseYamlScalarField(fm, "purpose");
    result.targetModel = parseYamlScalarField(fm, "target_model");
    result.variables = parseVariablesArray(fm);

    const { content: main, constraints } = splitConstraintsFromBody(body);
    result.content = main;
    result.constraints = constraints;
  } else {
    const cleaned = stripLeadingBom(content).trim();
    const { content: main, constraints } = splitConstraintsFromBody(cleaned);
    result.content = main;
    result.constraints = constraints;
  }

  return result;
}
