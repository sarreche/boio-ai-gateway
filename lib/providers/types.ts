import type { ChatRequest } from "@/lib/schemas/chat";
import type { EmbeddingsRequest } from "@/lib/schemas/embeddings";

export interface Usage {
  prompt_tokens: number;
  completion_tokens?: number;
  total_tokens: number;
}

export interface ChatResult {
  content: string;
  finishReason: string;
  usage?: Usage;
}

export interface EmbeddingResult {
  embeddings: number[][];
  usage?: Pick<Usage, "prompt_tokens" | "total_tokens">;
}

export interface ChatProvider {
  id: string;
  chat(request: ChatRequest): Promise<ChatResult>;
}

export interface EmbeddingProvider {
  id: string;
  embed(request: EmbeddingsRequest): Promise<EmbeddingResult>;
}

export type ProviderFailureKind = "client" | "rate_limit" | "timeout" | "network" | "provider" | "configuration";

export class ProviderFailure extends Error {
  constructor(
    public readonly kind: ProviderFailureKind,
    public readonly status?: number,
  ) {
    super(kind);
    this.name = "ProviderFailure";
  }

  get recoverable(): boolean {
    return this.kind === "rate_limit" || this.kind === "timeout" || this.kind === "network" || this.kind === "provider";
  }
}
