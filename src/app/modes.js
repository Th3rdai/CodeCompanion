export const MODES = [
  {
    id: "dashboard",
    label: "See Home →",
    icon: "🏠",
    desc: "Your home for recent work and feature discovery",
    placeholder: "", // Dashboard has no chat input
  },
  {
    id: "chat",
    label: "Chat",
    icon: "💬",
    desc: "Let's talk about anything",
    placeholder:
      "What's on your mind? Ask about code, building with AI, or just say hey...",
  },
  {
    id: "explain",
    label: "Explain This",
    icon: "💡",
    desc: "Walk me through this code",
    placeholder: "Paste some code and I'll walk you through it step by step...",
  },
  {
    id: "bugs",
    label: "Safety Check",
    icon: "🐛",
    desc: "Spot issues before they bite",
    placeholder:
      "Drop your code here — I'll look for anything that could cause trouble...",
  },
  {
    id: "refactor",
    label: "Clean Up",
    icon: "✨",
    desc: "Help me make this better",
    placeholder:
      "Paste code you'd like to improve — I'll show you what I'd change and why...",
  },
  {
    id: "translate-tech",
    label: "Code → Plain English",
    icon: "📋",
    desc: "Make this make sense to everyone",
    placeholder:
      "Paste code or a technical description...\nI'll explain it in plain English.",
  },
  {
    id: "translate-biz",
    label: "Idea → Code Spec",
    icon: "🔧",
    desc: "Turn ideas into buildable specs",
    placeholder:
      "Describe what you want built...\nI'll turn it into clear instructions for your AI coding tool.",
  },
  {
    id: "diagram",
    label: "Diagram",
    icon: "📊",
    desc: "Visualize systems and processes",
    placeholder:
      "Describe a system, process, or relationship and I'll create a diagram...",
  },
  {
    id: "pentest",
    label: "Security",
    icon: "🛡️",
    desc: "OWASP security assessment",
    placeholder: "",
  },
  {
    id: "validate",
    label: "Validate",
    icon: "✅",
    desc: "Generate project validation",
    placeholder: "",
  },
  {
    id: "experiment",
    label: "Experiment",
    icon: "🧪",
    desc: "Bounded hypothesis → change → measure loops",
    placeholder: "",
  },
  {
    id: "review",
    label: "Review",
    icon: "📝",
    desc: "Get a code report card",
    placeholder:
      "Submit code for a structured review with color-coded grades...",
  },
  {
    id: "prompting",
    label: "Prompting",
    icon: "🎯",
    desc: "Craft and score AI prompts",
    placeholder: "",
  },
  {
    id: "skillz",
    label: "Skillz",
    icon: "⚡",
    desc: "Build Claude Code skills",
    placeholder: "",
  },
  {
    id: "agentic",
    label: "Agentic",
    icon: "🤖",
    desc: "Design AI agents",
    placeholder: "",
  },
  {
    id: "planner",
    label: "Planner",
    icon: "📋",
    desc: "Design and score plans",
    placeholder: "",
  },
  {
    id: "create",
    label: "Create",
    icon: "🛠️",
    desc: "Start something new",
    placeholder:
      "Tell me what you want to build and I'll help you get started...",
  },
  {
    id: "build",
    label: "Build",
    icon: "🏗️",
    desc: "Start a GSD+ICM project to build apps and tools",
    placeholder: "Scaffold a project with planning and stages...",
  },
  {
    id: "terminal",
    label: "Terminal",
    icon: "⌨️",
    desc: "Interactive shell in your project folder",
    placeholder: "",
  },
];

export const BUILDER_MODES = ["prompting", "skillz", "agentic", "planner"];

/**
 * Modes that run the agentic TOOL_CALL loop and therefore consume agentMaxRounds.
 * Mirrors AGENTIC_TOOL_MODES in lib/chat-post-handler.js — transform modes
 * (explain, bugs, refactor, translate-tech, translate-biz, diagram) stream
 * without tools, so the Rounds control would be a no-op there.
 */
export const AGENTIC_TOOL_MODES = ["chat", "experiment"];

/** Modes where POST /api/chat uses agentMaxRounds and the user should see the header control. */
export function showAgentRoundsInHeader(mode) {
  return AGENTIC_TOOL_MODES.includes(mode);
}

/** Shown in the main strip; everything else lives under More or the command palette. */
export const PRIMARY_MODE_IDS = [
  "dashboard",
  "chat",
  "review",
  "pentest",
  "build",
  "create",
  "diagram",
  "experiment",
];

export const MORE_MENU_GROUPS = [
  {
    label: "Assist",
    ids: ["explain", "bugs", "refactor", "translate-tech", "translate-biz"],
  },
  {
    label: "Builders",
    ids: ["prompting", "skillz", "agentic", "planner"],
  },
  { label: "Analyze", ids: ["validate"] },
  { label: "Tools", ids: ["terminal"] },
];

export function modeById(id) {
  return MODES.find((m) => m.id === id);
}
