/**
 * MAKER Skill — Distilled MAKER framework for project scaffolding.
 *
 * Based on the MAKER methodology (Maximal Agentic decomposition,
 * first-to-ahead-by-K Error correction, and Red-flagging).
 * Adapted for LLM-driven project workflows: the AI itself acts as the agent,
 * using self-review passes instead of multi-agent voting, and pattern-based
 * red-flagging instead of infrastructure.
 */

const MAKER_SKILL_MD = `# MAKER — Zero-Error Task Execution

## What is MAKER?
A methodology for completing complex, multi-step tasks with zero errors.
Instead of hoping things work out, MAKER gives you a system: break work into
tiny pieces, verify each piece, and catch problems before they spread.

## The Three Principles

### 1. Maximal Decomposition
Break every task into the smallest possible subtasks. Each subtask should:
- Have a single, clear objective
- Take no more than one focused step to complete
- Be independently verifiable
- Have explicit success criteria

**Rule of thumb:** If you can describe a subtask with "and" in the middle,
it should be two subtasks.

### 2. Self-Verification (Voting)
Before moving to the next subtask, verify your output:
- **Pass 1 — Execute:** Complete the subtask
- **Pass 2 — Review:** Re-read your output as if you're a reviewer. Does it meet the success criteria?
- **Pass 3 — Red-flag scan:** Check against the red-flag patterns below

Only proceed when all three passes agree the output is correct.

### 3. Red-Flag Patterns
Stop and investigate if you detect any of these:

| Flag | Pattern | Action |
|------|---------|--------|
| RF-1 | Output contradicts a stated requirement | STOP — re-read requirement |
| RF-2 | Skipped a step or assumed a result | STOP — go back and do it |
| RF-3 | Output depends on unverified earlier output | STOP — verify dependency first |
| RF-4 | Confidence is low ("I think", "probably") | STOP — research or ask |
| RF-5 | Scope creep (doing more than asked) | STOP — trim to requirement |
| RF-6 | Format/structure doesn't match spec | STOP — re-read spec |

## How to Use MAKER in This Project

### During Each Stage
1. Read the stage's CONTEXT.md for objectives
2. Decompose the stage into numbered subtasks (write them in \`output/TASKS.md\`)
3. Execute each subtask one at a time
4. Run self-verification after each subtask
5. Log completion in \`output/PROGRESS.csv\`
6. Only move to next subtask after verification passes

### Task Tracking Format (output/TASKS.md)
\`\`\`markdown
# Tasks — [Stage Name]

## Decomposition
| # | Subtask | Success Criteria | Status |
|---|---------|------------------|--------|
| 1 | [atomic task] | [measurable outcome] | [ ] |
| 2 | [atomic task] | [measurable outcome] | [ ] |

## Red Flags Encountered
| Task # | Flag | Resolution |
|--------|------|------------|
\`\`\`

### Progress Log Format (output/PROGRESS.csv)
\`\`\`csv
task_number,description,status,verified,red_flags,notes
1,"[subtask]",complete,yes,none,""
2,"[subtask]",complete,yes,"RF-4: researched and confirmed",""
\`\`\`

## When to Use MAKER
- Projects with 5+ stages or steps
- Work where errors compound (each step builds on the last)
- Tasks requiring accuracy over speed
- Any project where "close enough" isn't good enough

## When MAKER is Overkill
- Simple single-step tasks
- Creative brainstorming (no right/wrong answer)
- Exploratory research with no fixed deliverable
`;

const MAKER_TASKS_TEMPLATE = `# Tasks — [Stage Name]

## Decomposition
| # | Subtask | Success Criteria | Status |
|---|---------|------------------|--------|
| 1 | [Define atomic subtask] | [What "done" looks like] | [ ] |

## Verification Log
| Task # | Pass 1 (Execute) | Pass 2 (Review) | Pass 3 (Red-flag) | Result |
|--------|-------------------|-----------------|---------------------|--------|

## Red Flags Encountered
| Task # | Flag | Resolution |
|--------|------|------------|
`;

const MAKER_PROGRESS_TEMPLATE = `task_number,description,status,verified,red_flags,notes
`;

/**
 * Returns the files to write into skills/maker/ when MAKER is enabled.
 * @returns {Array<{relPath: string, content: string}>}
 */
function getMakerSkillFiles() {
  return [
    { relPath: "skills/maker/MAKER.md", content: MAKER_SKILL_MD },
    {
      relPath: "skills/maker/TASKS-TEMPLATE.md",
      content: MAKER_TASKS_TEMPLATE,
    },
    {
      relPath: "skills/maker/PROGRESS-TEMPLATE.csv",
      content: MAKER_PROGRESS_TEMPLATE,
    },
  ];
}

/**
 * Returns additional CLAUDE.md instructions when MAKER is enabled.
 */
function getMakerClaudeInstructions() {
  return `
## MAKER Framework (Zero-Error Methodology)
This project uses the MAKER methodology for reliable multi-step execution.
- Read \`skills/maker/MAKER.md\` before starting any stage
- Decompose each stage into atomic subtasks using \`skills/maker/TASKS-TEMPLATE.md\`
- Track progress in each stage's \`output/PROGRESS.csv\` using \`skills/maker/PROGRESS-TEMPLATE.csv\`
- Run 3-pass self-verification on every subtask before proceeding
- Stop immediately on any red-flag pattern (see MAKER.md)
`;
}

module.exports = {
  getMakerSkillFiles,
  getMakerClaudeInstructions,
};
