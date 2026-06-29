/**
 * Unit tests for lib/harness-bridge.js — the in-process reader that replaced
 * the earlier external planning-CLI bridge. Verifies it parses a th3rdai-harness project's
 * .planning/ files into the exact shapes the Build UI consumes, and degrades
 * gracefully for an un-scaffolded project (no "tools not installed" error).
 */
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const HarnessBridge = require("../../lib/harness-bridge");

// Mirrors lib/build-scaffolder.js buildRoadmapMd() output (7-stage lifecycle).
const ROADMAP_7 = `# Roadmap: Demo

## Overview

Build this project using the th3rdai-harness 7-stage lifecycle.

## Phases

- [ ] **Phase 1: Task Definition** — Define the task, gather context, set scope (Researcher, Planner)
- [ ] **Phase 2: Agent Design** — Choose agents and the handoff sequence (Planner, Reviewer)
- [ ] **Phase 3: Prompt Design** — Design and version the agent prompts (Planner, Reviewer)
- [ ] **Phase 4: Tool Integration** — Wire up MCP + builtin tools, validate policies (Builder, Reviewer)
- [ ] **Phase 5: Evaluation** — Score prompts, tools, and workflow against rubrics (Evaluator, Reviewer)
- [ ] **Phase 6: Iteration** — Loop back based on evaluation feedback (Planner, Builder, Evaluator)
- [ ] **Phase 7: Release** — Finalize, commit, update docs, prepare to ship (Reviewer)

## Phase Details

### Phase 1: Task Definition
**Goal**: Establish what to build, for whom, and the success criteria.
**Depends on**: Nothing
`;

const STATE_MD = `# Project State

**Core value:** Deliver working software through the th3rdai-harness lifecycle.
**Current focus:** Phase 1 — Task Definition

## Current Position

Phase: 1 of 7 (Task Definition)
Status: Ready to plan

Progress: [░░░░░░░░░░] 0%
`;

function makeProject({ roadmap = ROADMAP_7, state = STATE_MD } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-bridge-"));
  const planning = path.join(dir, ".planning");
  fs.mkdirSync(path.join(planning, "phases"), { recursive: true });
  if (roadmap) fs.writeFileSync(path.join(planning, "ROADMAP.md"), roadmap);
  if (state) fs.writeFileSync(path.join(planning, "STATE.md"), state);
  fs.writeFileSync(
    path.join(planning, "PROJECT.md"),
    "# Demo\n\n## Core Value\n\nDeliver value.\n",
  );
  return dir;
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

test("getRoadmap parses all 7 lifecycle phases with required UI fields", () => {
  const dir = makeProject();
  try {
    const { phases } = new HarnessBridge(dir).getRoadmap();
    assert.strictEqual(phases.length, 7);
    const p1 = phases[0];
    assert.strictEqual(p1.number, 1);
    assert.strictEqual(p1.name, "Task Definition");
    assert.strictEqual(p1.status, "pending");
    assert.strictEqual(p1.disk_status, "pending");
    assert.ok(p1.goal && p1.goal.length > 0, "phase 1 should carry a goal");
    assert.strictEqual(p1.plan_count, 0);
    assert.strictEqual(p1.summary_count, 0);
    assert.strictEqual(phases[6].name, "Release");
  } finally {
    cleanup(dir);
  }
});

test("getProgress reports 0% for a fresh scaffold", () => {
  const dir = makeProject();
  try {
    const prog = new HarnessBridge(dir).getProgress();
    assert.deepStrictEqual(prog, {
      percent: 0,
      total_plans: 0,
      total_summaries: 0,
      total_phases: 7,
      completed_phases: 0,
    });
  } finally {
    cleanup(dir);
  }
});

test("getProgress reflects completed phases from [x] checkboxes", () => {
  const roadmap = ROADMAP_7.replace(
    "- [ ] **Phase 1: Task Definition**",
    "- [x] **Phase 1: Task Definition**",
  );
  const dir = makeProject({ roadmap });
  try {
    const prog = new HarnessBridge(dir).getProgress();
    assert.strictEqual(prog.completed_phases, 1);
    assert.strictEqual(prog.percent, 14); // round(1/7*100)
  } finally {
    cleanup(dir);
  }
});

test("getPhaseDetail returns phase meta and detects a written plan file", () => {
  const dir = makeProject();
  try {
    const bridge = new HarnessBridge(dir);
    let detail = bridge.getPhaseDetail(1);
    assert.strictEqual(detail.name, "Task Definition");
    assert.deepStrictEqual(detail.plans, []);

    // The /plan endpoint writes this filename — reader should pick it up.
    fs.writeFileSync(
      path.join(dir, ".planning", "phases", "phase-1-ai-plan.md"),
      "# Plan for phase 1\n\nDo the thing.\n",
    );
    detail = bridge.getPhaseDetail(1);
    assert.strictEqual(detail.plans.length, 1);
    assert.strictEqual(detail.plans[0].hasPlan, true);
    assert.strictEqual(detail.plans[0].hasSummary, false);
    assert.match(detail.plans[0].plan, /Plan for phase 1/);
  } finally {
    cleanup(dir);
  }
});

test("getState returns a non-error context object (never 'tools not installed')", () => {
  const dir = makeProject();
  try {
    const state = new HarnessBridge(dir).getState();
    assert.ok(!state.error, "state must not carry an error field");
    assert.strictEqual(state.currentPhase, 1);
    assert.strictEqual(state.totalPhases, 7);
    assert.ok(state.progress && typeof state.progress.percent === "number");
  } finally {
    cleanup(dir);
  }
});

test("un-scaffolded project degrades to empty-but-valid shapes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-bridge-empty-"));
  try {
    const bridge = new HarnessBridge(dir);
    assert.deepStrictEqual(bridge.getRoadmap(), { overview: "", phases: [] });
    assert.strictEqual(bridge.getProgress().percent, 0);
    const state = bridge.getState();
    assert.ok(!state.error);
    assert.strictEqual(state.status, "unscaffolded");
  } finally {
    cleanup(dir);
  }
});
