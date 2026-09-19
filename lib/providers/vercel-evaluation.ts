import { z } from "zod";
import type { EvaluationsRequest } from "@/lib/schemas/evaluations";
import { providerFetch, safeJson } from "@/lib/providers/http";
import { ProviderFailure, type EvaluationProvider, type EvaluationResult } from "@/lib/providers/types";

const probabilitySchema = z.number().min(0).max(1);
const answerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("boolean"), probability: probabilitySchema }),
  z.object({ type: z.literal("choice"), choice: z.string(), probabilities: z.record(z.string(), probabilitySchema) }),
  z.object({ type: z.literal("score"), score: z.number(), probabilities: z.record(z.string(), probabilitySchema) }),
]);

const responseSchema = z.object({
  answers: z.record(z.string(), answerSchema),
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }).optional(),
});

export class VercelEvaluationProvider implements EvaluationProvider {
  constructor(
    public readonly id: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async evaluate(request: EvaluationsRequest): Promise<EvaluationResult> {
    const { model: _publicModel, ...parameters } = request;
    const response = await providerFetch(`${this.baseUrl.replace(/\/$/, "")}/evaluate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...parameters, model: this.model }),
    }, this.timeoutMs);
    const parsed = responseSchema.safeParse(await safeJson(response));
    if (!parsed.success || !answersMatchQuestions(parsed.data.answers, request.questions)) {
      throw new ProviderFailure("provider", response.status);
    }
    const usage = parsed.data.usage
      ? {
          input_tokens: parsed.data.usage.inputTokens,
          output_tokens: parsed.data.usage.outputTokens,
          total_tokens: parsed.data.usage.inputTokens + parsed.data.usage.outputTokens,
        }
      : undefined;
    return { answers: parsed.data.answers, usage };
  }
}

function answersMatchQuestions(
  answers: z.infer<typeof responseSchema>["answers"],
  questions: EvaluationsRequest["questions"],
): boolean {
  const questionNames = Object.keys(questions);
  if (Object.keys(answers).length !== questionNames.length) return false;
  return questionNames.every((name) => {
    const question = questions[name];
    const answer = answers[name];
    if (!question || !answer || answer.type !== question.type) return false;
    if (question.type === "choice" && answer.type === "choice") {
      const options = Object.keys(question.criteria);
      return options.includes(answer.choice) && options.every((option) => option in answer.probabilities);
    }
    if (question.type === "score" && answer.type === "score") {
      return answer.score >= 0 && answer.score <= question.criteria.length - 1;
    }
    return true;
  });
}
