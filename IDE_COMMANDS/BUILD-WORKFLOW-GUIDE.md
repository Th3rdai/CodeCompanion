# Build feature — step-by-step PRP workflow

This guide is for **Build mode** in Code Companion: you’re driving a **GSD+ICM-style project** (or any app you scaffold and track in Build) with a repeatable loop—requirements → plan → implement → validate → summarize. The **slash-commands** below live in `IDE_COMMANDS/`; new projects created from Code Companion get copies under `.cursor/commands/`, `.claude/commands/`, etc.

Use this flow **in the project you are building** (open that folder in your IDE), not necessarily inside the Code Companion app repo—unless your task _is_ to change Code Companion itself.

**Visual diagram (Mermaid + optional Stitch / Nano Banana):** see **`BUILD-WORKFLOW-DIAGRAM.md`**.

---

## One-time setup (per project)

1. **Install the command files** into your project (see `IDE_COMMANDS/README.md` or Code Companion’s automatic copy when you scaffold).
2. **Create folders** (if missing): `PRDs/`, `PRPs/`, `PRPs/templates/`, `PRPs/prompts/`, `journal/`, and optionally `examples/` plus a root **`INITIAL.md`** scratch file for the feature.
3. **Run `/generate-validate` once** so your project gets a **repo-specific** validation playbook (the generated `validate-project` content). After that, validation matches _your_ stack (linters, tests, E2E)—not a generic template.

---

## Step-by-step flow

### Step 1 — (Optional) Write a PRD

**Command:** `/generate-prd`

**What it does:** Turns **INITIAL.md**, chat context, or notes into a professional **PRD** under `PRDs/`, using `PRPs/templates/prd_base.md` when present. You get goals, scope, requirements, success criteria, stakeholder-friendly language.

**When to skip:** You already have a clear PRD or you’re going straight from a short feature description to a PRP.

---

### Step 2 — Generate the execution plan (PRP)

**Command:** `/generate-prp`

**What it does:** Takes a **PRD path**, **INITIAL.md**, or a **plain feature description** and produces a **PRP** (execution plan). It asks the assistant to **research the codebase and the web**, then write the plan using **`PRPs/templates/prp_base.md`**, including:

- Multi-agent or multi-step **task breakdown**
- **Links** and **code references**
- **Acceptance-style** detail so the next step can run without guesswork

**Output:** A file under `PRPs/` (e.g. `PRPs/my-feature.md`).

---

### Step 3 — (Optional) Review and finalize the PRP before coding

**Command:** `/build-prp` (optionally with a path: `/build-prp PRPs/your-plan.md`)

**What it does:**

1. Resolves which **PRP file** to use (`$ARGUMENTS` or pick from `PRPs/`).
2. **Summarizes** the plan and calls out **gaps** (missing validation, unclear steps, risks).
3. **Waits for your explicit confirmation** that the plan is final (or applies edits you request).
4. Optionally **starts implementation** in the same session, or **stops** and tells you to run `/execute-prp` when ready.

**When to skip:** You’re confident in the PRP and want to go straight to Step 4.

---

### Step 4 — Implement from the PRP

**Command:** `/execute-prp` with the PRP path, e.g. `/execute-prp PRPs/my-feature.md`

**What it does:**

1. Loads the **PRP** you name (`$ARGUMENTS` = path).
2. Works in **phases**: plan with todos, implement, run **your project’s validations/tests**, fix failures.
3. **Appends a line** to **`journal/YYYY-MM-DD.md`** for traceability.

This is the main **“build the feature”** execution step.

---

### Step 5 — Validate the project

**Command:** `/validate-project` — **only** if you generated it with `/generate-validate` (your customized playbook).

**What it does:** The assistant runs **exactly** what that file defines (real shell phases for _your_ repo), not another project’s checks.

**Related:** The stock **`/validate`** file in `IDE_COMMANDS/` may still describe a _template_ example (e.g. another stack). Prefer **`validate-project`** after customization. For **Code Companion itself**, use the repo’s scripts (e.g. `npm run validate:static`, unit tests, Playwright E2E) as documented in `docs/TESTING.md`.

---

### Step 6 — Summarize outcomes

**Command:** `/summarize`

**What it does:** After validation or an execute cycle, produces a short **Completed / Next actions** summary from **journal**, **PRP**, and **validation** results so you can decide whether to ship, iterate, or run another command.

---

## Supporting commands (not the main Build line)

| Command                    | Use case                                                                                                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`/generate-prompt`**     | One-off **XML-style** structured prompt for an arbitrary task: ambiguity checks, complexity scoring, sections like objective / requirements / constraints / verification. Optional save under `PRPs/prompts/`. **Not** a full PRD→PRP→execute pipeline. |
| **`/generate-validate`**   | **Author or refresh** the project-specific validation command (run once or after big tooling changes). Feeds Step 5.                                                                                                                                    |
| **`/new-project`**         | Scaffold a **new** project **outside** the current repo (path/name, scripts, INITIAL.md, git)—when Build work should live in a **child** repo.                                                                                                          |
| **`/validate`** (template) | Validates the **template command pack** itself in some setups; **distinct** from `/validate-project` after you’ve customized.                                                                                                                           |

---

## The flow in one line

**Optional** `/generate-prd` → **`/generate-prp`** → **`/generate-validate`** (once per project) → **optional** `/build-prp` → **`/execute-prp`** → **`/validate-project`** → **`/summarize`**

Supporting tools: **`/new-project`** for a new repo, **`/generate-prompt`** for ad-hoc tasks, **`/generate-validate`** to keep validation current.

---

## How this ties to Code Companion **Build** mode

- **Build** is where you register and work on **local projects** (GSD+ICM scaffolding, stages, handoffs).
- This **PRP workflow** is how you—or the AI in your IDE—turn **what to build** into **ordered, verifiable work** on that project’s codebase.
- Keep **PRDs/PRPs/journal** in the **project repository** you’re building so history stays with the product, not only in chat.

For installing commands into a new project from this repo, see **`ADD-TO-PROJECT.md`** and **`README.md`** in this folder.
