const { z } = require("zod");

const ComparisonEnum = z.enum(["<", ">", "==", ">=", "<="]);

const ScopeSchema = z.object({
  paths: z.array(z.string()).default([]),
  commands: z.array(z.string()).default([]),
});

const MetricSpecSchema = z
  .object({
    name: z.string().min(1),
    target: z.number().nullable(),
    comparison: ComparisonEnum,
    unit: z.string().optional().nullable(),
  })
  .nullable();

const ReproducibilitySchema = z
  .object({
    note: z.string().optional().nullable(),
    seed: z.union([z.string(), z.number()]).optional().nullable(),
  })
  .nullable();

const StatusEnum = z.enum([
  "active",
  "completed",
  "aborted",
  "failed",
  "timeout",
]);

const DecisionEnum = z.enum(["keep", "iterate", "discard"]);

const DenialSchema = z.object({
  name: z.string().default(""),
  reason: z.string().default(""),
});

const StepMetricSchema = z
  .object({
    value: z.number().nullable(),
  })
  .nullable();

const StepSummarySchema = z.object({
  did: z.string().nullable().default(null),
  observed: z.string().nullable().default(null),
  next: z.string().nullable().default(null),
  done: z.boolean().default(false),
});

const ExperimentStepSchema = z.object({
  at: z.string(),
  role: z.string().default("assistant"),
  summary: z.string().default(""),
  did: z.string().nullable().default(null),
  observed: z.string().nullable().default(null),
  next: z.string().nullable().default(null),
  done: z.boolean().default(false),
  decision: DecisionEnum.nullable().default(null),
  denials: z.array(DenialSchema).default([]),
  metric: StepMetricSchema.default(null),
});

const ExperimentRecordSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  endedAt: z.string().nullable().default(null),
  status: StatusEnum.default("active"),
  hypothesis: z.string().default(""),
  maxRounds: z.number().int().positive().default(8),
  budgetSec: z.number().int().positive().nullable().default(null),
  conversationId: z.string().nullable().default(null),
  projectFolder: z.string().nullable().default(null),
  scope: ScopeSchema.nullable().default(null),
  metric: MetricSpecSchema.default(null),
  reproducibility: ReproducibilitySchema.default(null),
  promptHash: z.string().nullable().default(null),
  steps: z.array(ExperimentStepSchema).default([]),
  messageCountAtStart: z.number().int().nonnegative().default(0),
  denials: z.number().int().nonnegative().default(0),
  finalMetricValue: z.number().nullable().default(null),
  abortReason: z.string().nullable().default(null),
});

module.exports = {
  ComparisonEnum,
  ScopeSchema,
  MetricSpecSchema,
  ReproducibilitySchema,
  StatusEnum,
  DecisionEnum,
  DenialSchema,
  StepMetricSchema,
  StepSummarySchema,
  ExperimentStepSchema,
  ExperimentRecordSchema,
};
