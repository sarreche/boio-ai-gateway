import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "@/lib/providers/openai-compatible";
import { GeminiProvider } from "@/lib/providers/gemini";

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
});
