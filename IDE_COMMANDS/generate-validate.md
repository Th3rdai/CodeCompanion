# Generate Validate Command

**Prerequisites:** Use `example-validate.md` (in this commands folder) as the structure template. Optionally use `validation/ultimate_validate_command.md` for philosophy (user workflows, E2E levels)—if missing, use the example template and codebase analysis only.

**When to run:** **Once, or after a significant project change.** Run **after planning** (after `/generate-prp`), **before building**, so `/validate` exists for this project.

## Step 0: Discover Real User Workflows

**Before analyzing tooling, understand what users ACTUALLY do:**

1. Read workflow documentation:
   - README.md - Look for "Usage", "Quickstart", "Examples" sections
   - CLAUDE.md/AGENTS.md or similar - Look for workflow patterns
   - docs/ folder - User guides, tutorials

2. Identify external integrations:
   - What CLIs does the app use? (Check Dockerfile for installed tools)
   - What external APIs does it call? (Telegram, Slack, GitHub, etc.)
   - What services does it interact with?

3. Extract complete user journeys from docs:
   - Find examples like "Fix Issue (GitHub):" or "User does X → then Y → then Z"
   - Each workflow becomes an E2E test scenario

**Critical: Your E2E tests should mirror actual workflows from docs, not just test internal APIs.**

## Step 1: Deep Codebase Analysis

Explore the codebase to understand:

**What validation tools already exist:**

- Linting config: `.eslintrc*`, `.pylintrc`, `ruff.toml`, etc.
- Type checking: `tsconfig.json`, `mypy.ini`, etc.
- Style/formatting: `.prettierrc*`, `black`, `.editorconfig`
- Unit tests: `jest.config.*`, `pytest.ini`, test directories
- Package manager scripts: `package.json` scripts, `Makefile`, `pyproject.toml` tools

**What the application does:**

- Frontend: Routes, pages, components, user flows
- Backend: API endpoints, authentication, database operations
- Database: Schema, migrations, models
- Infrastructure: Docker services, dependencies

**How things are currently tested:**

- Existing test files and patterns
- CI/CD workflows (`.github/workflows/`, etc.)
- Test commands in package.json or scripts

## Step 2: Generate validate from the example template

**Follow the structure of example-validate.md:**

- Title and short description for _this_ codebase
- Phase 1: Linting (actual linter commands found in the project)
- Phase 2: Type Checking (actual type checker commands)
- Phase 3: Style Checking (actual formatter check commands)
- Phase 4: Unit Testing (actual test commands)
- Phase 5: End-to-End Testing (user workflows from docs; use Docker/curl/Playwright as in the example where applicable)
- Summary and, if the template includes it, journal entry instructions

**Only include phases that exist in the codebase.** Adapt paths and commands to this project (e.g. no `frontend/`/`backend/` if the project has a different layout).

**E2E (from validation/ultimate_validate_command.md):**

1. Internal APIs - endpoints, DB, commands
2. External integrations - CLIs, platform APIs
3. Complete user journeys from docs

## Output: Create /validate in all IDEs

Write the generated validation so **`/validate`** is available in every IDE:

1. **`.claude/commands/validate.md`** – Claude Code (primary output)
2. **`.cursor/prompts/validate.md`** – Cursor (copy same content)
3. **`.cursor/commands/validate.md`** – Cursor commands folder (copy same content)
4. **`.github/prompts/validate.prompt.md`** – VS Code Copilot (same content; add YAML frontmatter with `description:` and `mode:` if needed for that IDE)

Use the same phase structure and format as example-validate.md (e.g. `!` for runnable commands where the IDE supports it, or clear bash/code blocks).

**Journal entry (required):** The generated command MUST include a "Journal entry" section. Use the same format as example-validate.md (ensure journal/ exists, append one line to journal/YYYY-MM-DD.md, optional journal/README.md update).

The result should be executable, practical, and give complete confidence in the codebase. Users run **`/validate`** to run this project's validation.
