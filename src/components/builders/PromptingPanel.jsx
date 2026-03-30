import React from "react";
import BaseBuilderPanel from "./BaseBuilderPanel";

const PROMPTING_CONFIG = {
  modeId: "prompting",
  title: "Prompt Builder",
  subtitle: "Craft, test, and score your AI prompts",
  icon: "🎯",
  fields: [
    {
      name: "content",
      label: "Prompt Text",
      type: "textarea",
      placeholder:
        "Write your prompt here...\n\nTip: Include context, constraints, and examples for better results.",
      required: true,
      large: true,
    },
    {
      name: "purpose",
      label: "Purpose",
      type: "text",
      placeholder:
        'What should this prompt achieve? (e.g., "Generate unit tests for React components")',
    },
    {
      name: "targetModel",
      label: "Target Model",
      type: "text",
      placeholder: "Which AI is this for? (e.g., Claude, GPT-4, Llama)",
    },
    {
      name: "variables",
      label: "Variables",
      type: "tags",
      placeholder:
        "Add placeholder variables (e.g., language, framework, context)",
    },
    {
      name: "constraints",
      label: "Constraints",
      type: "textarea",
      placeholder:
        'Any boundaries or requirements? (e.g., "Keep response under 500 words", "Use markdown format")',
    },
  ],
  categories: [
    { key: "clarity", label: "Clarity", icon: "Eye" },
    { key: "specificity", label: "Specificity", icon: "Target" },
    { key: "structure", label: "Structure", icon: "LayoutList" },
    { key: "effectiveness", label: "Effectiveness", icon: "Zap" },
  ],
  buildContent: (formData) => {
    const lines = ["---"];
    if (formData.purpose) lines.push(`purpose: "${formData.purpose}"`);
    if (formData.targetModel)
      lines.push(`target_model: "${formData.targetModel}"`);
    if (formData.variables?.length)
      lines.push(
        `variables: [${formData.variables.map((v) => `"${v}"`).join(", ")}]`,
      );
    lines.push("---", "");
    lines.push(formData.content || "");
    if (formData.constraints) {
      lines.push("", "## Constraints", "", formData.constraints);
    }
    return lines.join("\n");
  },
  parseLoaded: (content) => {
    const result = {
      content: "",
      purpose: "",
      targetModel: "",
      variables: [],
      constraints: "",
    };
    if (!content) return result;

    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      const fm = fmMatch[1];
      const body = fmMatch[2].trim();

      const purposeMatch = fm.match(/purpose:\s*"([^"]*)"/);
      if (purposeMatch) result.purpose = purposeMatch[1];

      const modelMatch = fm.match(/target_model:\s*"([^"]*)"/);
      if (modelMatch) result.targetModel = modelMatch[1];

      const varsMatch = fm.match(/variables:\s*\[(.*?)\]/);
      if (varsMatch)
        result.variables = varsMatch[1]
          .split(",")
          .map((v) => v.trim().replace(/"/g, ""))
          .filter(Boolean);

      const constraintSplit = body.split(/\n## Constraints\n/);
      result.content = constraintSplit[0].trim();
      if (constraintSplit[1]) result.constraints = constraintSplit[1].trim();
    } else {
      result.content = content;
    }
    return result;
  },
  fileExtension: ".md",
  defaultFilename: "prompt",
  nameField: "purpose",
};

export default function PromptingPanel(props) {
  return <BaseBuilderPanel {...props} config={PROMPTING_CONFIG} />;
}
