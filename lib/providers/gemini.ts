import { z } from "zod";
import type { ChatRequest } from "@/lib/schemas/chat";
import type { EmbeddingsRequest } from "@/lib/schemas/embeddings";
import { providerFetch, safeJson } from "@/lib/providers/http";
import { ProviderFailure, type ChatProvider, type ChatResult, type EmbeddingProvider, type EmbeddingResult } from "@/lib/providers/types";

const chatResponseSchema = z.object({
  candidates: z.array(z.object({
    content: z.object({ parts: z.array(z.object({ text: z.string().optional() })).min(1) }),
    finishReason: z.string().optional(),
  })).min(1),
  usageMetadata: z.object({
    promptTokenCount: z.number().int().nonnegative().optional(),
    candidatesTokenCount: z.number().int().nonnegative().optional(),
    totalTokenCount: z.number().int().nonnegative().optional(),
  }).optional(),
});

const embeddingsResponseSchema = z.object({
  embeddings: z.array(z.object({ values: z.array(z.number()) })),
  usageMetadata: z.object({ totalTokenCount: z.number().int().nonnegative().optional() }).optional(),
});

export class GeminiProvider implements ChatProvider, EmbeddingProvider {
  constructor(
    public readonly id: string,
    private readonly apiKey: string,
    private readonly model: string,
    private readonly timeoutMs: number,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResult> {
    const system = request.messages.filter((message) => message.role === "system").map((message) => message.content).join("\n");
    const contents = request.messages.filter((message) => message.role !== "system").map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
    const generationConfig = {
      ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
      ...(request.max_tokens === undefined ? {} : { maxOutputTokens: request.max_tokens }),
      ...(request.top_p === undefined ? {} : { topP: request.top_p }),
      ...(request.stop === undefined ? {} : { stopSequences: Array.isArray(request.stop) ? request.stop : [request.stop] }),
    };
    const response = await providerFetch(`${this.modelUrl()}:generateContent`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        contents,
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        ...(Object.keys(generationConfig).length ? { generationConfig } : {}),
      }),
    }, this.timeoutMs);
    const parsed = chatResponseSchema.safeParse(await safeJson(response));
    if (!parsed.success) throw new ProviderFailure("provider", response.status);
    const candidate = parsed.data.candidates[0];
    const content = candidate.content.parts.map((part) => part.text ?? "").join("");
    if (!content) throw new ProviderFailure("provider", response.status);
    const usage = parsed.data.usageMetadata;
    return {
      content,
      finishReason: normalizeFinishReason(candidate.finishReason),
      ...(usage?.promptTokenCount !== undefined && usage.totalTokenCount !== undefined ? {
        usage: {
          prompt_tokens: usage.promptTokenCount,
          completion_tokens: usage.candidatesTokenCount ?? Math.max(0, usage.totalTokenCount - usage.promptTokenCount),
          total_tokens: usage.totalTokenCount,
        },
      } : {}),
    };
  }

  async embed(request: EmbeddingsRequest): Promise<EmbeddingResult> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const model = `models/${this.model}`;
    const response = await providerFetch(`${this.modelUrl()}:batchEmbedContents`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ requests: inputs.map((text) => ({ model, content: { parts: [{ text }] } })) }),
    }, this.timeoutMs);
    const parsed = embeddingsResponseSchema.safeParse(await safeJson(response));
    if (!parsed.success || parsed.data.embeddings.length !== inputs.length) throw new ProviderFailure("provider", response.status);
    const total = parsed.data.usageMetadata?.totalTokenCount;
    return {
      embeddings: parsed.data.embeddings.map((embedding) => embedding.values),
      ...(total === undefined ? {} : { usage: { prompt_tokens: total, total_tokens: total } }),
    };
  }

  private modelUrl(): string {
    return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}`;
  }

  private headers(): HeadersInit {
    return { "x-goog-api-key": this.apiKey, "Content-Type": "application/json" };
  }
}

function normalizeFinishReason(reason?: string): string {
  if (!reason) return "stop";
  if (reason === "MAX_TOKENS") return "length";
  if (reason === "STOP") return "stop";
  return "stop";
}
