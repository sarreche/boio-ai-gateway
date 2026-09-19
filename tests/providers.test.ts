import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "@/lib/providers/openai-compatible";
import { GeminiProvider } from "@/lib/providers/gemini";
import { VercelEvaluationProvider } from "@/lib/providers/vercel-evaluation";

afterEach(() => vi.unstubAllGlobals());

describe("provider normalization", () => {
  it("normalizes an OpenAI-compatible response and sends the configured model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ choices: [{ message: { content: "answer" }, finish_reason: "length" }] }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new OpenAICompatibleProvider("test", "https://example.test/v1/", "secret", "configured-model", 1000);
    await expect(provider.chat({ messages: [{ role: "user", content: "question" }] })).resolves.toEqual({ content: "answer", finishReason: "length", usage: undefined });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: "configured-model", stream: false });
  });

  it("normalizes Gemini chat and role mappings", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      candidates: [{ content: { parts: [{ text: "answer" }] }, finishReason: "MAX_TOKENS" }],
      usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 2, totalTokenCount: 5 },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new GeminiProvider("gemini", "secret", "configured-model", 1000);
    const result = await provider.chat({ messages: [{ role: "system", content: "rules" }, { role: "assistant", content: "prior" }, { role: "user", content: "question" }] });
    expect(result).toMatchObject({ content: "answer", finishReason: "length", usage: { total_tokens: 5 } });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toMatchObject({ systemInstruction: { parts: [{ text: "rules" }] }, contents: [{ role: "model" }, { role: "user" }] });
  });

  it("normalizes every Jev decision primitive and hides provider metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      model: "typesafe-ai/jev",
      answers: {
        shouldEscalate: { type: "boolean", probability: 0.91 },
        destination: { type: "choice", choice: "billing", probabilities: { billing: 0.8, technical: 0.2 } },
        urgency: { type: "score", score: 1.75, probabilities: { "0": 0.05, "1": 0.15, "2": 0.8 } },
      },
      usage: { inputTokens: 25, outputTokens: 6 },
      providerMetadata: { gateway: { cost: "secret", generationId: "gen_secret" } },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new VercelEvaluationProvider("vercel", "https://ai-gateway.vercel.sh/v1/", "secret", "typesafe-ai/jev", 1000);
    const result = await provider.evaluate({
      state: { ticket: "I was charged twice and need help now" },
      questions: {
        shouldEscalate: { type: "boolean", instructions: "Should this be escalated?" },
        destination: { type: "choice", instructions: "Where should this be routed?", criteria: { billing: "Payment issue", technical: "Product issue" } },
        urgency: { type: "score", instructions: "How urgent is it?", criteria: ["low", "medium", "high"] },
      },
    });
    expect(result).toEqual({
      answers: {
        shouldEscalate: { type: "boolean", probability: 0.91 },
        destination: { type: "choice", choice: "billing", probabilities: { billing: 0.8, technical: 0.2 } },
        urgency: { type: "score", score: 1.75, probabilities: { "0": 0.05, "1": 0.15, "2": 0.8 } },
      },
      usage: { input_tokens: 25, output_tokens: 6, total_tokens: 31 },
    });
    expect(fetchMock).toHaveBeenCalledWith("https://ai-gateway.vercel.sh/v1/evaluate", expect.objectContaining({
      headers: { Authorization: "Bearer secret", "Content-Type": "application/json" },
    }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ model: "typesafe-ai/jev" });
  });

  it("rejects an evaluation response that does not match the requested primitive", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      answers: { approved: { type: "choice", choice: "yes", probabilities: { yes: 1, no: 0 } } },
    })));
    const provider = new VercelEvaluationProvider("vercel", "https://example.test/v1", "secret", "typesafe-ai/jev", 1000);
    await expect(provider.evaluate({
      state: "The change passed review.",
      questions: { approved: { type: "boolean", instructions: "Was it approved?" } },
    })).rejects.toMatchObject({ kind: "provider" });
  });
});
