import { z } from "zod";

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

const nonEmptyStateSchema = z.union([
  z.string().min(1),
  z.array(jsonValueSchema).min(1),
  z.record(z.string(), jsonValueSchema).refine((value) => Object.keys(value).length > 0),
]);

const booleanQuestionSchema = z.object({
  type: z.literal("boolean"),
  instructions: z.string().min(1),
  criteria: z.object({ true: z.string().min(1), false: z.string().min(1) }).optional(),
});

const choiceQuestionSchema = z.object({
  type: z.literal("choice"),
  instructions: z.string().min(1),
  criteria: z.record(z.string().min(1), z.string().min(1)).refine((value) => Object.keys(value).length >= 2),
});

const scoreQuestionSchema = z.object({
  type: z.literal("score"),
  instructions: z.string().min(1),
  criteria: z.array(z.string().min(1)).min(2),
});

export const evaluationQuestionSchema = z.discriminatedUnion("type", [
  booleanQuestionSchema,
  choiceQuestionSchema,
  scoreQuestionSchema,
]);

export const evaluationsRequestSchema = z.object({
  model: z.enum(["gateway", "default"]).optional(),
  state: nonEmptyStateSchema,
  questions: z.record(z.string().min(1), evaluationQuestionSchema)
    .refine((value) => Object.keys(value).length > 0),
}).strict();

export type EvaluationsRequest = z.infer<typeof evaluationsRequestSchema>;
export type EvaluationQuestion = z.infer<typeof evaluationQuestionSchema>;
