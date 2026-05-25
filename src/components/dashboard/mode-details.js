/**
 * Rich, vibe-coder-friendly detail copy for the Feature Grid info modal.
 *
 * Keyed by mode id. Each entry adds depth beyond the one-line `desc` shown on
 * the tile: a friendly `summary`, a short `bestFor` list ("Great for…"), and an
 * optional `tip`. The modal degrades gracefully — any mode without an entry
 * here still shows its `desc`.
 *
 * Tone: friendly-teacher, plain language, no jargon (matches the app's voice).
 */
export const MODE_DETAILS = {
  chat: {
    summary:
      "Your everyday conversation with a coding-savvy helper. Ask questions, paste code, brainstorm, or just think out loud — no special format required.",
    bestFor: [
      "Quick questions about code or tools",
      "Brainstorming an approach before you build",
      "Pasting an error and asking what it means",
    ],
    tip: "When your model supports it, Chat can read files and run commands to help hands-on.",
  },
  explain: {
    summary:
      "Paste any code and get a plain-English, step-by-step walkthrough of what it does and why — like a patient tutor reading it alongside you.",
    bestFor: [
      "Understanding code an AI tool generated for you",
      "Making sense of an unfamiliar file",
      "Learning how a piece of logic actually works",
    ],
    tip: "Don't worry about length — paste the whole thing and ask about the parts that confuse you.",
  },
  bugs: {
    summary:
      "A friendly once-over that hunts for problems hiding in your code before they cause trouble — bugs, risky patterns, and easy-to-miss mistakes.",
    bestFor: [
      "Checking AI-generated code before you rely on it",
      "Catching issues you can't quite spot yourself",
      "Peace of mind on something important",
    ],
    tip: "Run this whenever you're about to use code in the real world.",
  },
  refactor: {
    summary:
      "Suggests ways to make working code cleaner, simpler, and easier to maintain — and explains the reasoning behind every change.",
    bestFor: [
      "Tidying up messy or copy-pasted code",
      "Making code easier to read later",
      "Picking up better patterns as you go",
    ],
    tip: "It shows what it would change and why, so you stay in control of what actually gets applied.",
  },
  "translate-tech": {
    summary:
      "Turns code or technical jargon into clear, everyday language anyone can understand — no computer-science degree required.",
    bestFor: [
      "Explaining what a script does to a teammate",
      "Writing notes or docs in plain words",
      "Understanding technical text you were handed",
    ],
    tip: "Great for turning a scary wall of code into a sentence you can actually repeat.",
  },
  "translate-biz": {
    summary:
      "Describe what you want in plain words and get a clear, buildable spec your AI coding tool can actually follow.",
    bestFor: [
      "Turning a rough idea into clear instructions",
      "Prepping a prompt for Cursor, Claude Code, and others",
      "Making sure you and the AI agree on the goal",
    ],
    tip: "The clearer your idea here, the better the code you'll get downstream.",
  },
  diagram: {
    summary:
      "Describe a system, flow, or relationship and get an interactive diagram you can zoom, theme, and export — no drawing tools needed.",
    bestFor: [
      "Visualizing how parts of an app connect",
      "Mapping a process or user flow",
      "Explaining structure to other people",
    ],
    tip: "Export diagrams as SVG or PNG to drop straight into docs and slides.",
  },
  pentest: {
    summary:
      "A guided security review based on the industry-standard OWASP checklist, with findings explained in approachable terms and fixes you can apply.",
    bestFor: [
      "Checking an app for common security risks",
      "Understanding why something is risky",
      "Getting a remediation plan you can act on",
    ],
    tip: "Use Remediate to download a fixed copy of your files alongside the report.",
  },
  validate: {
    summary:
      "Scans your project and generates a phased validation plan — linting, type checks, tests, and more — that installs straight into your AI coding tools.",
    bestFor: [
      "Setting up quality checks on a new project",
      "Knowing your code actually works",
      "One-click setup for Claude Code, Cursor, and friends",
    ],
    tip: "It writes a validate.md you can install to several IDEs at once.",
  },
  experiment: {
    summary:
      "Run small, safe 'what if' loops: form a hypothesis, make one focused change, and measure the result — without risking your whole project.",
    bestFor: [
      "Trying an idea without big risk",
      "Comparing two approaches side by side",
      "Learning by doing, in bounded steps",
    ],
    tip: "Keep each experiment small so the result is easy to read.",
  },
  review: {
    summary:
      "Get a color-coded report card for your code with A–F grades across bugs, security, readability, and completeness — plus notes on how to improve.",
    bestFor: [
      "A thorough quality check on one or many files",
      "Seeing strengths and weak spots at a glance",
      "Deciding what to fix first",
    ],
    tip: "Use Scan Folder to grade a whole project at once.",
  },
  prompting: {
    summary:
      "Craft, score, and improve AI prompts with a proven method, then watch your grade climb as you refine — like a coach for talking to AI.",
    bestFor: [
      "Writing prompts that get better results",
      "Learning what makes a prompt effective",
      "Saving and reusing your best prompts",
    ],
    tip: "Apply a suggested revision and re-score to watch your grade improve.",
  },
  skillz: {
    summary:
      "Build reusable Claude Code 'skills' — packaged instructions that teach your AI assistant to do a task your way, every time.",
    bestFor: [
      "Automating a repeatable task for your AI",
      "Capturing your preferred way of working",
      "Sharing know-how across projects",
    ],
    tip: "Skills follow the Agent Skills spec, so they work wherever Claude Code runs.",
  },
  agentic: {
    summary:
      "Design AI agents — define their purpose, tools, workflow, and guardrails — and get them scored before you turn them loose.",
    bestFor: [
      "Planning an agent that does real work",
      "Deciding what tools and limits it needs",
      "Avoiding common agent-design mistakes",
    ],
    tip: "Clear guardrails up front save you headaches later.",
  },
  planner: {
    summary:
      "Turn a goal into a clear implementation plan, then score it for quality so you catch gaps before you start building.",
    bestFor: [
      "Breaking a big task into ordered steps",
      "Pressure-testing a plan before you code",
      "Handing a solid plan to an AI builder",
    ],
    tip: "A higher-scoring plan usually means smoother building.",
  },
  create: {
    summary:
      "Kick off something new with a friendly wizard — answer a few questions and get a scaffolded starting point you can build on.",
    bestFor: [
      "Starting a fresh project the right way",
      "Getting boilerplate set up for you",
      "Moving from idea to first files fast",
    ],
    tip: "When you're done, use Open in Build to keep going with guided stages.",
  },
  build: {
    summary:
      "Scaffold and grow a full project using the GSD+ICM workflow — planning, stages, and IDE commands wired in from the start.",
    bestFor: [
      "Building apps and tools step by step",
      "Keeping a bigger project organized",
      "Working alongside AI coding assistants",
    ],
    tip: "Build drops ready-to-use commands into Claude Code, Cursor, and more.",
  },
  terminal: {
    summary:
      "A real interactive shell that opens right in your project folder — run commands without ever leaving the app (desktop only).",
    bestFor: [
      "Running git, npm, or any CLI command",
      "Staying in one place while you work",
      "Quick tasks in your project folder",
    ],
    tip: "The terminal follows your active File Browser folder.",
  },
};

/** Look up rich detail for a mode id, or null when none exists. */
export function getModeDetails(modeId) {
  return MODE_DETAILS[modeId] || null;
}
