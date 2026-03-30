# Development-by-Iteration Commands

These are **workflow commands** you can add to **any project** (new or existing) to structure development by iteration: define requirements (PRD), plan execution (PRP), build, validate, and summarize in a repeatable way. They are designed for use with AI-assisted IDEs (e.g. Cursor, Claude Code, VS Code with Copilot).

You can **install** them into a project so slash-commands like `/generate-prd` and `/execute-prp` appear, or **use them without installing** by copying a command file’s text into the chat and having the AI follow it.

---

## What’s in this folder

- **Command files** (`.md`) — One file per workflow (e.g. `generate-prd.md`, `execute-prp.md`, `validate.md`). Each file is the full instruction set for that workflow.
- **`BUILD-WORKFLOW-GUIDE.md`** — Step-by-step PRP pipeline for Build mode (PRD → PRP → execute → validate → summarize).
- **`BUILD-WORKFLOW-DIAGRAM.md`** — Mermaid diagram for that pipeline; notes for **Stitch** + **Nano Banana** MCP (image / UI companion).
- **Reference docs** — `ADD-TO-PROJECT.md` (install and folder setup), `EFFICIENCY-REVIEW.md` (design notes). Not needed for copy/paste use.

**Typical flow:** PRD (what to build) → PRP (how to build it, in order) → build/execute → validate → summarize. You can run the whole flow or any single step.

**Step-by-step (Build / PRP):** See **`BUILD-WORKFLOW-GUIDE.md`** for a numbered walkthrough, command roles, and how this maps to Code Companion Build mode.

---

## Option 1: Install commands into your project

Installing makes slash-commands available inside that project (e.g. `/generate-prp`, `/validate`).

### Step 1: Copy the command files into your project

From this folder, copy **all `.md` files** into your project’s commands directory for your IDE. Create the directory if it doesn’t exist.

| IDE / product       | Path under your project root                                           |
| ------------------- | ---------------------------------------------------------------------- |
| **Cursor**          | `.cursor/commands/`                                                    |
| **Claude Code**     | `.claude/commands/`                                                    |
| **VS Code Copilot** | `.github/prompts/` (use `.prompt.md` suffix if your setup requires it) |

**Which files:** Every `.md` in this folder **except** `README.md`, `ADD-TO-PROJECT.md`, and `EFFICIENCY-REVIEW.md` (those are reference only). So copy at least: `build-prp.md`, `execute-prp.md`, `generate-prd.md`, `generate-prp.md`, `generate-validate.md`, `generate-prompt.md`, `new-project.md`, `summarize.md`, `validate.md`, `example-validate.md`, `e2e-test.md`.

**From a terminal** (set paths to match your machine):

```bash
# Set paths (example)
COMMANDS_PATH="/path/to/this/commands/folder"
PROJECT_PATH="/path/to/your/project"

# Cursor
mkdir -p "$PROJECT_PATH/.cursor/commands"
cp "$COMMANDS_PATH"/build-prp.md "$COMMANDS_PATH"/execute-prp.md "$COMMANDS_PATH"/generate-prd.md "$COMMANDS_PATH"/generate-prp.md "$COMMANDS_PATH"/generate-validate.md "$COMMANDS_PATH"/generate-prompt.md "$COMMANDS_PATH"/new-project.md "$COMMANDS_PATH"/summarize.md "$COMMANDS_PATH"/validate.md "$COMMANDS_PATH"/example-validate.md "$COMMANDS_PATH"/e2e-test.md "$PROJECT_PATH/.cursor/commands/"

# Or copy everything then remove reference docs from the project if you prefer:
# cp "$COMMANDS_PATH"/*.md "$PROJECT_PATH/.cursor/commands/"
```

### Step 2: (Optional) Add folder structure for the full workflow

If you want to use `/generate-prd`, `/generate-prp`, `/build-prp`, and `/execute-prp` without extra setup, create these under your **project root**:

```bash
mkdir -p PRPs/prompts PRPs/templates PRDs examples journal
```

- **PRDs/** — Where product requirements (PRD) are saved.
- **PRPs/** — Where execution plans (PRP) are saved; `PRPs/templates/` can hold `prp_base.md` and `prd_base.md` if you have them.
- **journal/** — Daily log of what was run (build-prp, execute-prp, validate, summarize).
- **examples/** — Optional; for INITIAL.md and references.

Optional file in project root: **INITIAL.md** — Scratch pad for the feature; `/generate-prd` and `/generate-prp` can use it as input.

### Step 3: Open the project in your IDE

Open the project (e.g. `cursor .` or `claude .`). The slash-commands should appear. Run **`/generate-validate`** once so the `/validate` command is tailored to your stack (lint, test, type-check, etc.).

More detail (including journal format and templates): see **ADD-TO-PROJECT.md** in this folder.

---

## Option 2: Use without installing (copy/paste from file into chat)

You can run any of these workflows **without installing** by pasting the command file’s text into the AI chat. The model will follow the instructions in that text.

### Step-by-step: run a command by copy/paste

1. **Choose the workflow** you want (e.g. “generate a PRD”, “execute a PRP”, “validate the project”, “summarize what’s done”).
2. **Open the matching `.md` file** in this folder in your editor (e.g. `generate-prd.md`, `execute-prp.md`, `validate.md`, `summarize.md`).
3. **Select all and copy** the entire file contents (no need to change anything).
4. **Paste into the AI chat** (e.g. Cursor, Claude Code, or any chat that has access to your project).
5. **Add any arguments** the command needs:
   - For **execute-prp** or **build-prp**: in a follow-up message (or at the top of the paste) say which PRP file to use, e.g. _“Use PRPs/daily-quote-app.md”_ or _“$ARGUMENTS: PRPs/my-feature.md”_.
   - For **generate-prp** or **generate-prd**: say the input (e.g. _“Use INITIAL.md”_ or _“PRDs/my-app.md”_), or type the feature description.
   - For **validate**, **summarize**, **e2e-test**, **generate-prompt**: usually no extra argument unless the file says so.
6. **Send.** The AI will treat the pasted text as the command and run through the steps (e.g. load PRP → implement → validate → journal).

### Example: execute a PRP by copy/paste

1. Open **execute-prp.md** in this folder.
2. Copy the entire file (Cmd+A / Ctrl+A, then Cmd+C / Ctrl+C).
3. Paste into the chat.
4. Send a second message: **“Use PRPs/my-feature.md”** (or the path to your PRP file).
5. The AI will load that PRP, implement it, run validation, and complete the steps in the file.

### Example: generate a PRD by copy/paste

1. Open **generate-prd.md**.
2. Copy the entire file and paste into the chat.
3. Send a follow-up: **“Use INITIAL.md”** or **“Input: we need a small CLI that backs up the project to S3.”**
4. The AI will follow the generate-prd process and produce a PRD (e.g. in `PRDs/` if that folder exists).

### Tips for copy/paste use

- **Project context:** Use copy/paste in a chat that already has your project open or in context so the AI can read and edit your repo.
- **Folders:** If the command writes to `PRDs/`, `PRPs/`, or `journal/`, create those folders in your project first (see “Optional: Add folder structure” above) so the command can write there.
- **Arguments:** If the command says `$ARGUMENTS` or “Input:”, add that in your message (e.g. file path or feature description).

---

## Command list (quick reference)

| Command file           | What it does                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `new-project.md`       | Create a new project from a template (folders, INITIAL.md, optional git).                                                 |
| `generate-prd.md`      | Turn INITIAL.md or a description into a Product Requirements Document (PRD) in `PRDs/`.                                   |
| `generate-prp.md`      | Turn a PRD (or INITIAL.md) into an execution plan (PRP) in `PRPs/` with tasks and validation.                             |
| `build-prp.md`         | Finalize a PRP with the user, then optionally build and run (same flow as execute-prp).                                   |
| `execute-prp.md`       | Implement a PRP: load file → plan → implement → validate → journal (and optionally run the app).                          |
| `validate.md`          | Run project validation (example: lint, type-check, test). Replace with project-specific version via `/generate-validate`. |
| `generate-validate.md` | Create a project-specific `/validate` command from your repo’s tooling.                                                   |
| `summarize.md`         | Summarize what was completed and suggest next actions (e.g. after validate or execute-prp).                               |
| `e2e-test.md`          | E2E testing with browser automation (research app + DB, then run user journeys, screenshots, DB checks).                  |
| `generate-prompt.md`   | Generate an XML-structured prompt for a task (ambiguity check, complexity, verification).                                 |
| `example-validate.md`  | Example validation command structure (reference for generate-validate).                                                   |

---

## Flow at a glance

- **Plan:** INITIAL.md or idea → `/generate-prd` → PRD in `PRDs/` → `/generate-prp` → PRP in `PRPs/`.
- **Build:** `/build-prp` (review then build) or `/execute-prp` (implement a PRP).
- **Check:** `/validate` (run project validation), then `/summarize` (what’s done, what’s next).

You can repeat the cycle (e.g. change INITIAL or PRD → regenerate PRP → execute-prp again) to develop by iteration.
