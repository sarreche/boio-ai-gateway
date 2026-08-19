import { z } from "zod";
import type { ChatRequest } from "@/lib/schemas/chat";
import { providerFetch, safeJson } from "@/lib/providers/http";
import { ProviderFailure, type ChatProvider, type ChatResult } from "@/lib/providers/types";

const responseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({ content: z.string() }),
    finish_reason: z.string().nullable().optional(),
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    completion_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  }).optional(),
});

export class OpenAICompatibleProvider implements ChatProvider {
  constructor(
    public readonly id: string,
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResult> {
    const { model: _publicModel, stream: _stream, ...parameters } = request;
    const response = await providerFetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...parameters, model: this.model, stream: false }),
    }, this.timeoutMs);
    const parsed = responseSchema.safeParse(await safeJson(response));
    if (!parsed.success) throw new ProviderFailure("provider", response.status);
    const choice = parsed.data.choices[0];
    return { content: choice.message.content, finishReason: choice.finish_reason ?? "stop", usage: parsed.data.usage };
  }
}
