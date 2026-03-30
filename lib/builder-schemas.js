const { z } = require("zod");

// ── Grade enum ───────────────────────────────────────

const GradeEnum = z.enum(["A", "B", "C", "D", "F"]);

// ── Grade values for numeric conversion ──────────────

const gradeValues = { A: 4, B: 3, C: 2, D: 1, F: 0 };

// ── Score category schema ────────────────────────────

const ScoreCategorySchema = z.object({
  grade: GradeEnum,
  summary: z.string(),
  suggestions: z.array(z.string()),
});

// ── Prompt score schema ──────────────────────────────

const PromptScoreSchema = z.object({
  overallGrade: GradeEnum,
  summary: z.string(),
  categories: z.object({
    clarity: ScoreCategorySchema,
    specificity: ScoreCategorySchema,
    structure: ScoreCategorySchema,
    effectiveness: ScoreCategorySchema,
  }),
});

// ── Skillz score schema ──────────────────────────────

const SkillScoreSchema = z.object({
  overallGrade: GradeEnum,
  summary: z.string(),
  categories: z.object({
    completeness: ScoreCategorySchema,
    formatCompliance: ScoreCategorySchema,
    instructionQuality: ScoreCategorySchema,
    reusability: ScoreCategorySchema,
  }),
});

// ── Agentic score schema ─────────────────────────────

const AgentScoreSchema = z.object({
  overallGrade: GradeEnum,
  summary: z.string(),
  categories: z.object({
    purposeClarity: ScoreCategorySchema,
    toolDesign: ScoreCategorySchema,
    workflowLogic: ScoreCategorySchema,
    safetyGuardrails: ScoreCategorySchema,
  }),
});

// ── Planner score schema ─────────────────────────────

const PlannerScoreSchema = z.object({
  overallGrade: GradeEnum,
  summary: z.string(),
  categories: z.object({
    clarity: ScoreCategorySchema,
    feasibility: ScoreCategorySchema,
    completeness: ScoreCategorySchema,
    structure: ScoreCategorySchema,
  }),
});

// ── Schema map by mode id ────────────────────────────

const SCORE_SCHEMAS = {
  prompting: PromptScoreSchema,
  skillz: SkillScoreSchema,
  agentic: AgentScoreSchema,
  planner: PlannerScoreSchema,
};

// ── JSON schemas for Ollama format parameter ─────────

const scoreJsonSchemas = {
  prompting: z.toJSONSchema(PromptScoreSchema),
  skillz: z.toJSONSchema(SkillScoreSchema),
  agentic: z.toJSONSchema(AgentScoreSchema),
  planner: z.toJSONSchema(PlannerScoreSchema),
};

module.exports = {
  GradeEnum,
  gradeValues,
  ScoreCategorySchema,
  PromptScoreSchema,
  SkillScoreSchema,
  AgentScoreSchema,
  PlannerScoreSchema,
  SCORE_SCHEMAS,
  scoreJsonSchemas,
};
