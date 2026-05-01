import BaseBuilderPanel from "./BaseBuilderPanel";
import { parsePromptingLoaded } from "../../lib/prompting-parse-loaded.js";

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
  parseLoaded: parsePromptingLoaded,
  fileExtension: ".md",
  defaultFilename: "prompt",
  nameField: "purpose",
};

export default function PromptingPanel(props) {
  return <BaseBuilderPanel {...props} config={PROMPTING_CONFIG} />;
}
