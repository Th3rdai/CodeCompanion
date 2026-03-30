# Add These Commands to Any Project

Use this guide to add the context-engineering workflow commands to **any** project—new or existing. No need to run "new project" from a template; you can drop these commands in and optionally add the folder structure.

## What You're Adding

- **Commands:** PRD/PRP workflow (`generate-prd`, `generate-prp`, `build-prp`, `execute-prp`), validation (`validate`, `generate-validate`, `example-validate`), E2E testing (`e2e-test`), summarization (`summarize`), prompt generation (`generate-prompt`), and project setup (`new-project`).
- **Optional:** Folders (`PRPs/`, `PRDs/`, `journal/`, etc.) and templates so the full workflow works without extra setup.

## Where These Command Files Live

- **Source:** The folder containing this file (e.g. a `commands/` directory you cloned or copied).
- **Destination:** Your project root. Commands are copied into IDE-specific paths under that root.

## Copy Targets by IDE

Copy the `.md` command files from the source folder into the paths below **inside your project**. Create parent directories if they don't exist.

| IDE / Product        | Commands location (under project root)                   |
| -------------------- | -------------------------------------------------------- |
| **Cursor**           | `.cursor/commands/`                                      |
| **Cursor (prompts)** | `.cursor/prompts/` (optional; same content as commands)  |
| **Claude Code**      | `.claude/commands/`                                      |
| **VS Code Copilot**  | `.github/prompts/` (use `.prompt.md` suffix if required) |

### Files to copy

Copy **all `*.md`** from this folder into each location (or the one for your IDE), **except** `ADD-TO-PROJECT.md` and `EFFICIENCY-REVIEW.md` (reference only). Optional checklist:

- `build-prp.md`, `execute-prp.md`, `generate-prd.md`, `generate-prp.md`, `generate-validate.md`, `generate-prompt.md`, `new-project.md`, `summarize.md`, `validate.md`, `example-validate.md`, `e2e-test.md`

**Note:** `validate.md` is an example (Akassets-specific). After copying, run `/generate-validate` in your project to create a project-specific `/validate` command that overwrites or replaces it as needed.

## Optional: Folder Structure for Full Workflow

For `/generate-prd`, `/generate-prp`, `/build-prp`, and `/execute-prp` to work without extra setup, create these under the project root:

```bash
mkdir -p PRPs/prompts PRPs/templates PRDs examples journal
```

- **PRPs/** — Execution plans (output of `/generate-prp`).
- **PRPs/templates/** — Optional. Put `prp_base.md` and `prd_base.md` here if you have them (from a context-engineering template); otherwise the generate commands will ask you to add or create them.
- **PRDs/** — Product requirements (output of `/generate-prd`).
- **journal/** — Daily log (used by build-prp, execute-prp, validate, summarize).
- **examples/** — Optional; for INITIAL.md and references.

Optional file:

- **INITIAL.md** (project root) — Scratch pad for the feature you want; `/generate-prd` and `/generate-prp` can use it as input.

## Optional: Minimal Templates

If you use `/generate-prp` or `/generate-prd`, those commands expect (or can create) minimal templates:

- **PRPs/templates/prp_base.md** — Structure for execution plans (sections, multi-agent task breakdown).
- **PRPs/templates/prd_base.md** — Structure for PRDs (Overview, Requirements, Success Criteria, etc.).

If you don't have these, the commands describe what's needed; you can create stub files or copy from a context-engineering template repo.

## Journal convention (single source of truth)

Commands that complete a milestone (build-prp, execute-prp, validate, summarize) append one line to a daily log:

1. Ensure `journal/` exists: `mkdir -p journal`
2. Append one line to `journal/YYYY-MM-DD.md` (today's date). Format: `HH:MM | <command> | <context> | <outcome>`
   - build-prp: `HH:MM | build-prp | PRPs/<path> | Finalized` or `Built` or `Built and run`
   - execute-prp: `HH:MM | execute-prp | PRPs/<path> | Completed`
   - validate: `HH:MM | Pass/Fail | E:N W:M | P1:OK P2:OK ... | optional note`
3. Optionally update `journal/README.md` with one line per date for the latest outcome.

## Quick Copy (from a repo or folder)

If this `commands` folder is at `COMMANDS_PATH` and your project is at `PROJECT_PATH`:

```bash
COMMANDS_PATH="/path/to/commands"   # e.g. AI_Dev/_AI-IDEs/commands
PROJECT_PATH="/path/to/my-project"

# Cursor
mkdir -p "$PROJECT_PATH/.cursor/commands"
cp "$COMMANDS_PATH"/*.md "$PROJECT_PATH/.cursor/commands/"
# Optional: remove ADD-TO-PROJECT.md and EFFICIENCY-REVIEW.md from destination if you don't want them in the commands list

# Claude Code
mkdir -p "$PROJECT_PATH/.claude/commands"
cp "$COMMANDS_PATH"/*.md "$PROJECT_PATH/.claude/commands/"

# Optional: folder structure
mkdir -p "$PROJECT_PATH/PRPs/prompts" "$PROJECT_PATH/PRPs/templates" "$PROJECT_PATH/PRDs" "$PROJECT_PATH/examples" "$PROJECT_PATH/journal"
```

## After Adding

1. Open your project in the IDE (Cursor, Claude Code, or VS Code).
2. Confirm the slash-commands appear (e.g. `/generate-prd`, `/execute-prp`).
3. For project-specific validation: run **`/generate-validate`** once to create a `/validate` command tailored to your stack.
4. Optional: Add or create `PRPs/templates/prp_base.md` and `prd_base.md` if you use `/generate-prp` and `/generate-prd`.

## Adding to an Existing Project

Same as above. You don't need to run `/new-project`. Copy the command files into your project's `.cursor/commands/` and/or `.claude/commands/`, then optionally add the folders and templates. Your existing code and structure stay as they are; the commands add the workflow on top.
