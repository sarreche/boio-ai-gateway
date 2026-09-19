import { describe, expect, it } from "vitest";
import { getProviderTimeout, parseConfig } from "@/lib/config";

describe("configuration validation", () => {
  it("rejects an invalid provider configuration", () => {
    expect(() => parseConfig({ chat: { strategy: "random", providers: [] }, embeddings: {} })).toThrow();
  });

  it("rejects insecure provider URLs", () => {
    expect(() => parseConfig({
      chat: { strategy: "priority", providers: [{ id: "x", type: "openai-compatible", baseUrl: "http://example.com", apiKeyEnv: "KEY", model: "m", enabled: true, priority: 1 }] },
      embeddings: { strategy: "priority", providers: [{ id: "e", type: "gemini", apiKeyEnv: "KEY", model: "m", enabled: true, priority: 1 }] },
      evaluations: { strategy: "priority", providers: [{ id: "v", type: "vercel-evaluation", baseUrl: "https://example.com/v1", apiKeyEnv: "KEY", model: "m", enabled: true, priority: 1 }] },
    })).toThrow();
  });

  it("accepts a Vercel evaluation provider over HTTPS", () => {
    expect(parseConfig({
      chat: { strategy: "priority", providers: [{ id: "x", type: "openai-compatible", baseUrl: "https://example.com", apiKeyEnv: "KEY", model: "m", enabled: true, priority: 1 }] },
      embeddings: { strategy: "priority", providers: [{ id: "e", type: "gemini", apiKeyEnv: "KEY", model: "m", enabled: true, priority: 1 }] },
      evaluations: { strategy: "priority", providers: [{ id: "v", type: "vercel-evaluation", baseUrl: "https://ai-gateway.vercel.sh/v1", apiKeyEnv: "VERCEL_GATEWAY_API_KEY", model: "typesafe-ai/jev", enabled: true, priority: 1 }] },
    }).evaluations.providers[0]).toMatchObject({ id: "v", type: "vercel-evaluation" });
  });

  it("validates timeout configuration", () => {
    expect(getProviderTimeout({ AI_PROVIDER_TIMEOUT_MS: "2500" })).toBe(2500);
    expect(() => getProviderTimeout({ AI_PROVIDER_TIMEOUT_MS: "never" })).toThrow();
  });
});
