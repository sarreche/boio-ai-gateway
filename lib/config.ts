import modelsFile from "@/config/models.json";
import { z } from "zod";

const commonProviderSchema = z.object({
  id: z.string().min(1),
  apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  model: z.string().min(1),
  enabled: z.boolean(),
  priority: z.number().int().nonnegative(),
});

const openAIProviderSchema = commonProviderSchema.extend({
  type: z.literal("openai-compatible"),
  baseUrl: z.string().url().refine((url) => url.startsWith("https://"), "baseUrl must use HTTPS"),
});

const geminiProviderSchema = commonProviderSchema.extend({ type: z.literal("gemini") });
export const providerConfigSchema = z.discriminatedUnion("type", [openAIProviderSchema, geminiProviderSchema]);
const capabilitySchema = z.object({
  strategy: z.literal("priority"),
  providers: z.array(providerConfigSchema).min(1),
});
export const gatewayConfigSchema = z.object({
  chat: capabilitySchema,
  embeddings: capabilitySchema,
}).superRefine((config, context) => {
  for (const capability of [config.chat, config.embeddings]) {
    const ids = new Set<string>();
    for (const provider of capability.providers) {
      if (ids.has(provider.id)) context.addIssue({ code: "custom", message: `Duplicate provider id: ${provider.id}` });
      ids.add(provider.id);
    }
  }
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type GatewayConfig = z.infer<typeof gatewayConfigSchema>;

export function parseConfig(input: unknown): GatewayConfig {
  return gatewayConfigSchema.parse(input);
}

const config = parseConfig(modelsFile);

export function getConfig(): GatewayConfig {
  return config;
}

type Environment = Readonly<Record<string, string | undefined>>;

export function getEnabledProviders(capability: "chat" | "embeddings", env: Environment = process.env): Array<ProviderConfig & { apiKey: string }> {
  return config[capability].providers
    .filter((provider) => provider.enabled)
    .sort((left, right) => left.priority - right.priority)
    .map((provider) => {
      const apiKey = env[provider.apiKeyEnv]?.trim();
      if (!apiKey) throw new Error(`Provider "${provider.id}" references missing environment variable ${provider.apiKeyEnv}`);
      return { ...provider, apiKey };
    });
}

export function getProviderTimeout(env: Environment = process.env): number {
  const raw = env.AI_PROVIDER_TIMEOUT_MS ?? "30000";
  const parsed = z.coerce.number().int().positive().max(120_000).safeParse(raw);
  if (!parsed.success) throw new Error("AI_PROVIDER_TIMEOUT_MS must be an integer between 1 and 120000");
  return parsed.data;
}
