import BaseBuilderPanel from "./BaseBuilderPanel";
import { parseSkillzLoaded } from "../../lib/skillz-parse-loaded.js";

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
  parseLoaded: parseSkillzLoaded,
  fileExtension: ".md",
  defaultFilename: "SKILL",
  nameField: "skillName",
};

export default function SkillzPanel(props) {
  return <BaseBuilderPanel {...props} config={SKILLZ_CONFIG} />;
}
