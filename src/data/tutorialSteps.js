/**
 * Tutorial step content and prefill data for Build and Create wizards.
 * Each step has: title, body (short explanation), and prefill (object to merge into wizard state).
 */

export const BUILD_TUTORIAL_STEPS = [
  {
    title: "Project Info",
    body: "Give your build project a name and a short description of what you want to build. This will be used to generate planning files and folder structure. The slug (URL-friendly name) is created automatically from the project name.",
    prefill: {
      name: "My First Build",
      description:
        "A small app or tool I want to plan and build step by step using GSD (planning) and ICM (stages).",
    },
  },
  {
    title: "Audience & Tone",
    body: "Who will use or benefit from this? The audience helps the AI tailor the planning. Pick a tone that matches how you want the generated plans and instructions to sound — e.g. Professional for work, Friendly for personal projects.",
    prefill: {
      audience: "Myself and maybe a small team",
      tone: "Friendly",
    },
  },
  {
    title: "Output Location",
    body: "Choose the parent folder where the project will be created. The project will get its own folder inside this path (e.g. ~/AI_Dev/ becomes ~/AI_Dev/my-first-build/). You can leave the default if you use a folder like AI_Dev for your projects.",
    prefill: {
      outputRoot: "~/AI_Dev/",
    },
  },
  {
    title: "Review & Create",
    body: 'Check the summary. When you click "Create Build Project", Code Companion will scaffold a full project with .planning/ and stages so you can use the Build dashboard and GSD workflows. You can then open the project in Cursor or Claude Code.',
    prefill: null,
  },
];

export const CREATE_TUTORIAL_STEPS = [
  {
    title: "Project Info",
    body: 'Name your project and describe what it’s for. The AI role tells the assistant how to behave in this project (e.g. "content writing assistant" or "research analyst"). This is used when generating your project structure and convention files.',
    prefill: {
      name: "My Blog Assistant",
      description:
        "A project to draft and refine blog posts with an AI writing assistant.",
      role: "Content writing assistant that helps draft and edit posts in a friendly, clear tone.",
    },
  },
  {
    title: "Audience & Tone",
    body: "Who will use the output of this project? Pick a tone so the generated instructions and prompts match how you want to communicate (e.g. Professional for clients, Warm for readers).",
    prefill: {
      audience: "Blog readers and casual visitors",
      tone: "Warm",
    },
  },
  {
    title: "Stages",
    body: "Stages are the main phases of your workflow (e.g. Research → Draft → Review). You can rename them and add or remove stages. Enable MAKER Framework if you want zero-error methodology with verified subtasks.",
    prefill: {
      stages: [
        { name: "Research", purpose: "Gather and organize source material" },
        { name: "Draft", purpose: "Create first draft from research findings" },
        {
          name: "Review",
          purpose: "Quality check, edit, and produce final version",
        },
      ],
    },
  },
  {
    title: "Output Location",
    body: "Choose the parent folder where the project will be created. The project gets its own folder inside this path. Use the default if you keep your projects in a folder like AI_Dev.",
    prefill: {
      outputRoot: "~/AI_Dev/",
    },
  },
  {
    title: "Review & Create",
    body: 'Review the summary. When you click "Create Project", Code Companion will scaffold the folder structure, stages, and convention files so you can open the project in Cursor, Claude Code, or other AI coding tools.',
    prefill: null,
  },
];
