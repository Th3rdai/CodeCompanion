#!/usr/bin/env bash
# Harness validation script — checks all expected files exist
# Run: bash harness/scripts/validate-harness.sh

set -euo pipefail

HARNESS_DIR="${1:-harness}"
PASS=0
FAIL=0

check() {
  if [ -f "$HARNESS_DIR/$1" ]; then
    echo "  ✅ $1"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $1 — MISSING"
    FAIL=$((FAIL + 1))
  fi
}

check_dir() {
  if [ -d "$HARNESS_DIR/$1" ]; then
    echo "  ✅ $1/ (directory)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $1/ — MISSING DIRECTORY"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== CodeCompanion Harness Validation ==="
echo ""

echo "Phase 1: Scaffold"
check_dir "_config"
check_dir "agents"
check_dir "configs"
check_dir "docs"
check_dir "evals"
check_dir "mcp"
check_dir "models"
check_dir "plans"
check_dir "prompts"
check_dir "runs"
check_dir "scripts"
check_dir "shared"
check_dir "skills"
check_dir "stages"
check_dir "telemetry"
echo ""

echo "Phase 2: Orientation Layer"
check "CLAUDE.md"
check "CONTEXT.md"
check "FRAMEWORK.md"
check "README.md"
echo ""

echo "Phase 3: Agent Contracts"
check "agents/researcher.agent.md"
check "agents/planner.agent.md"
check "agents/builder.agent.md"
check "agents/reviewer.agent.md"
check "agents/evaluator.agent.md"
echo ""

echo "Phase 4: Configs"
check "configs/agents.yaml"
check "configs/routing.yaml"
check "configs/models.yaml"
check "configs/tools.yaml"
check "configs/autonomy.yaml"
check "configs/execution.yaml"
echo ""

echo "Phase 5: Skills"
check "skills/research/research.md"
check "skills/plan/planner.md"
check "skills/build/build.md"
check "skills/review/review.md"
check "skills/security/security.md"
check "skills/validate/validate.md"
check "skills/eval/eval.md"
check "skills/prompt/prompt.md"
check "skills/tests/tests.md"
check "skills/commit/commit.md"
check "skills/debug/debug.md"
check "skills/run/run.md"
check "skills/revise/revise.md"
check "skills/new-project/new-project.md"
echo ""

echo "Phase 5: Stage Contracts"
check "stages/01-task-definition/README.md"
check "stages/02-agent-design/README.md"
check "stages/03-prompt-design/README.md"
check "stages/04-tool-integration/README.md"
check "stages/05-evaluation/README.md"
check "stages/06-iteration/README.md"
check "stages/07-release/README.md"
echo ""

echo "Phase 6: Migration & Docs"
check "docs/migration-mapping.md"
check "scripts/validate-harness.sh"
echo ""

echo "=== Results ==="
echo "Passed: $PASS"
echo "Failed: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo ""
  echo "🎉 All harness files present — validation PASSED"
  exit 0
else
  echo ""
  echo "⚠️  $FAIL file(s) missing — validation FAILED"
  exit 1
fi