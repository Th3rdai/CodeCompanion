const { z } = require("zod");

// ── Grade enum ───────────────────────────────────────

const GradeEnum = z.enum(["A", "B", "C", "D", "F"]);

// ── Finding schema ───────────────────────────────────

const FindingSchema = z.object({
  title: z.string(),
  severity: z.enum(["critical", "high", "medium", "low"]),
  explanation: z.string(),
  analogy: z.string().optional(),
  suggestedFix: z.string().optional(),
  fixPrompt: z.string().optional(),
});

// ── Category schema ──────────────────────────────────

const CategorySchema = z.object({
  grade: GradeEnum,
  summary: z.string(),
  findings: z.array(FindingSchema),
});

// ── Report card schema ───────────────────────────────

const ReportCardSchema = z.object({
  overallGrade: GradeEnum,
  topPriority: z.object({
    category: z.string(),
    title: z.string(),
    explanation: z.string(),
  }),
  categories: z.object({
    bugs: CategorySchema,
    security: CategorySchema,
    readability: CategorySchema,
    completeness: CategorySchema,
  }),
  cleanBillOfHealth: z.boolean(),
  structureReviewOnly: z.boolean().optional(),
});

// ── JSON Schema for Ollama format parameter ──────────

const reportCardJsonSchema = z.toJSONSchema(ReportCardSchema);

module.exports = {
  GradeEnum,
  FindingSchema,
  CategorySchema,
  ReportCardSchema,
  reportCardJsonSchema,
};
