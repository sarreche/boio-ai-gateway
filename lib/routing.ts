import type { ChatRequest } from "@/lib/schemas/chat";
import type { EmbeddingsRequest } from "@/lib/schemas/embeddings";
import type { EvaluationsRequest } from "@/lib/schemas/evaluations";
import { getEnabledProviders, getProviderTimeout, type ProviderConfig } from "@/lib/config";
import { GeminiProvider } from "@/lib/providers/gemini";
import { OpenAICompatibleProvider } from "@/lib/providers/openai-compatible";
import { VercelEvaluationProvider } from "@/lib/providers/vercel-evaluation";
import { ProviderFailure, type ChatProvider, type ChatResult, type EmbeddingProvider, type EmbeddingResult, type EvaluationProvider, type EvaluationResult } from "@/lib/providers/types";
import { logProviderAttempt } from "@/lib/logger";

type Endpoint = "chat" | "embeddings" | "evaluations";

export async function routeChat(request: ChatRequest, requestId: string): Promise<ChatResult> {
  return route("chat", makeChatProviders(), requestId, (provider) => provider.chat(request));
}

export async function routeEmbeddings(request: EmbeddingsRequest, requestId: string): Promise<EmbeddingResult> {
  return route("embeddings", makeEmbeddingProviders(), requestId, (provider) => provider.embed(request));
}

export async function routeEvaluations(request: EvaluationsRequest, requestId: string): Promise<EvaluationResult> {
  return route("evaluations", makeEvaluationProviders(), requestId, (provider) => provider.evaluate(request));
}

export async function route<TProvider extends { id: string }, TResult>(
  endpoint: Endpoint,
  providers: TProvider[],
  requestId: string,
  invoke: (provider: TProvider) => Promise<TResult>,
): Promise<TResult> {
  if (!providers.length) throw new ProviderFailure("configuration");
  let lastError = new ProviderFailure("provider");
  for (const [index, provider] of providers.entries()) {
    const started = Date.now();
    try {
      const result = await invoke(provider);
      logProviderAttempt({ requestId, endpoint, provider: provider.id, durationMs: Date.now() - started, status: "success", fallbackUsed: index > 0 });
      return result;
    } catch (error) {
      const failure = error instanceof ProviderFailure ? error : new ProviderFailure("provider");
      lastError = failure;
      logProviderAttempt({ requestId, endpoint, provider: provider.id, durationMs: Date.now() - started, status: "error", fallbackUsed: index > 0 });
      if (!failure.recoverable) throw failure;
    }
  }
  throw lastError;
}

function makeChatProviders(): ChatProvider[] {
  const timeout = getProviderTimeout();
  return getEnabledProviders("chat").map((provider) => makeProvider(provider, timeout));
}

function makeEmbeddingProviders(): EmbeddingProvider[] {
  const timeout = getProviderTimeout();
  return getEnabledProviders("embeddings").map((provider) => {
    if (provider.type !== "gemini") throw new ProviderFailure("configuration");
    return new GeminiProvider(provider.id, provider.apiKey, provider.model, timeout);
  });
}

function makeEvaluationProviders(): EvaluationProvider[] {
  const timeout = getProviderTimeout();
  return getEnabledProviders("evaluations").map((provider) => {
    if (provider.type !== "vercel-evaluation") throw new ProviderFailure("configuration");
    return new VercelEvaluationProvider(provider.id, provider.baseUrl, provider.apiKey, provider.model, timeout);
  });
}

function makeProvider(provider: ProviderConfig & { apiKey: string }, timeout: number): ChatProvider {
  return provider.type === "openai-compatible"
    ? new OpenAICompatibleProvider(provider.id, provider.baseUrl, provider.apiKey, provider.model, timeout)
    : new GeminiProvider(provider.id, provider.apiKey, provider.model, timeout);
}
