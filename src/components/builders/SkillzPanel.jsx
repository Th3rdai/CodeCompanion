import React from "react";
import BaseBuilderPanel from "./BaseBuilderPanel";

const SKILLZ_CONFIG = {
  modeId: "skillz",
  title: "Skill Builder",
  subtitle: "Create and score Claude Code skills",
  icon: "⚡",
  fields: [
    {
      name: "skillName",
      label: "Skill Name",
      type: "text",
      placeholder: "e.g., code-review, test-generator, doc-writer",
      required: true,
    },
    {
      name: "description",
      label: "Description",
      type: "text",
      placeholder: "One-line summary of what this skill does",
    },
    {
      name: "instructions",
      label: "Instructions",
      type: "textarea",
      placeholder:
        "The core skill instructions...\n\nTell the AI exactly what to do, step by step.\nInclude constraints, quality checks, and output expectations.",
      required: true,
      large: true,
    },
    {
      name: "inputPattern",
      label: "Input Pattern",
      type: "textarea",
      placeholder:
        'What triggers this skill? What input does it expect?\n\ne.g., "When the user provides a file path and asks for a review..."',
    },
    {
      name: "outputFormat",
      label: "Output Format",
      type: "textarea",
      placeholder:
        'What should the output look like?\n\ne.g., "Return a markdown report with sections for..."',
    },
    {
      name: "exampleUsage",
      label: "Example Usage",
      type: "textarea",
      placeholder:
        "Show an example of using this skill:\n\nInput: ...\nOutput: ...",
    },
  ],
  categories: [
    { key: "completeness", label: "Completeness", icon: "CheckSquare" },
    { key: "formatCompliance", label: "Format", icon: "FileCheck" },
    { key: "instructionQuality", label: "Instructions", icon: "BookOpen" },
    { key: "reusability", label: "Reusability", icon: "Repeat" },
  ],
  buildContent: (formData) => {
    const lines = [];
    lines.push(`# ${formData.skillName || "Untitled Skill"}`);
    lines.push("");
    if (formData.description) {
      lines.push(formData.description);
      lines.push("");
    }
    lines.push("## Instructions");
    lines.push("");
    lines.push(formData.instructions || "");
    lines.push("");
    if (formData.inputPattern) {
      lines.push("## Input Pattern");
      lines.push("");
      lines.push(formData.inputPattern);
      lines.push("");
    }
    if (formData.outputFormat) {
      lines.push("## Output Format");
      lines.push("");
      lines.push(formData.outputFormat);
      lines.push("");
    }
    if (formData.exampleUsage) {
      lines.push("## Example Usage");
      lines.push("");
      lines.push(formData.exampleUsage);
      lines.push("");
    }
    return lines.join("\n");
  },
  parseLoaded: (content) => {
    const result = {
      skillName: "",
      description: "",
      instructions: "",
      inputPattern: "",
      outputFormat: "",
      exampleUsage: "",
    };
    if (!content) return result;

    let body = content;

    // Handle YAML frontmatter (--- ... ---) — common in real SKILL.md files
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      const fm = fmMatch[1];
      body = fmMatch[2].trim();

      // Extract description from frontmatter
      const descMatch = fm.match(/description:\s*(.+)/);
      if (descMatch)
        result.description = descMatch[1].trim().replace(/^["']|["']$/g, "");
    }

    // Parse heading
    const nameMatch = body.match(/^# (.+)$/m);
    if (nameMatch) result.skillName = nameMatch[1];

    // Parse sections
    const sections = body.split(/\n## /);
    // First section after title is description (before any ## heading)
    if (sections[0]) {
      const afterTitle = sections[0].replace(/^# .+\n*/, "").trim();
      if (afterTitle && !afterTitle.startsWith("## ")) {
        // If no description from frontmatter, use the text after the title
        if (!result.description) result.description = afterTitle;
      }
    }

    let hasInstructionSection = false;
    for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const headerEnd = section.indexOf("\n");
      const header = section.substring(0, headerEnd).trim().toLowerCase();
      const sectionBody = section.substring(headerEnd).trim();

      if (header.includes("instruction")) {
        result.instructions = sectionBody;
        hasInstructionSection = true;
      } else if (header.includes("input") && header.includes("pattern"))
        result.inputPattern = sectionBody;
      else if (header.includes("output") && header.includes("format"))
        result.outputFormat = sectionBody;
      else if (header.includes("example")) result.exampleUsage = sectionBody;
    }

    // If no ## Instructions section found, treat the entire body (after title/description) as instructions
    if (!hasInstructionSection) {
      const afterHeading = body.replace(/^# .+\n*/, "").trim();
      const afterDescription =
        result.description && afterHeading.startsWith(result.description)
          ? afterHeading.slice(result.description.length).trim()
          : afterHeading;
      if (afterDescription) result.instructions = afterDescription;
    }

    return result;
  },
  fileExtension: ".md",
  defaultFilename: "SKILL",
  nameField: "skillName",
};

export default function SkillzPanel(props) {
  return <BaseBuilderPanel {...props} config={SKILLZ_CONFIG} />;
}
