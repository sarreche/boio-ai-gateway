import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleChat, handleEmbeddings, handleEvaluations } from "@/lib/handlers";

const originalEnv = { ...process.env };

function request(path: string, body: unknown, token?: string): Request {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.GATEWAY_API_KEYS = "valid-key,second-key";
  process.env.GROQ_API_KEY = "groq-secret";
  process.env.OPENROUTER_API_KEY = "openrouter-secret";
  process.env.GEMINI_API_KEY = "gemini-secret";
  process.env.VERCEL_GATEWAY_API_KEY = "vercel-secret";
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("authentication and chat validation", () => {
  it("rejects a missing token", async () => {
    const response = await handleChat(request("/v1/chat/completions", { messages: [{ role: "user", content: "Hi" }] }));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_api_key" } });
  });

  it("rejects an invalid token", async () => {
    const response = await handleChat(request("/v1/chat/completions", { messages: [{ role: "user", content: "Hi" }] }, "wrong"));
    expect(response.status).toBe(401);
  });

  it.each([
    [{ messages: [] }, "invalid_request"],
    [{ messages: [{ role: "tool", content: "Hi" }] }, "invalid_request"],
    [{ messages: [{ role: "user", content: "Hi" }], stream: true }, "unsupported_streaming"],
    [{ model: "internal-model", messages: [{ role: "user", content: "Hi" }] }, "invalid_request"],
  ])("rejects an invalid chat body", async (body, code) => {
    const response = await handleChat(request("/v1/chat/completions", body, "valid-key"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code } });
  });

  it("allows a valid token and hides the provider model", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      id: "provider-id", model: "secret-provider-model",
      choices: [{ message: { content: "Hello!" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
    })));
    const response = await handleChat(request("/v1/chat/completions", { model: "gateway", messages: [{ role: "user", content: "Hi" }] }, "valid-key"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(/^req_/);
    expect(body).toMatchObject({ model: "gateway", choices: [{ message: { content: "Hello!" } }] });
    expect(JSON.stringify(body)).not.toContain("secret-provider-model");
  });
});

describe("embeddings", () => {
  it.each([{ input: "" }, { input: [] }, { input: ["valid", ""] }])("rejects invalid input", async (body) => {
    const response = await handleEmbeddings(request("/v1/embeddings", body, "valid-key"));
    expect(response.status).toBe(400);
  });

  it.each([
    ["one", [[0.1, 0.2]]],
    [["one", "two"], [[0.1], [0.2]]],
  ])("accepts single and multiple input while preserving order", async (input, vectors) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      embeddings: vectors.map((values) => ({ values })),
      usageMetadata: { totalTokenCount: 4 },
    })));
    const response = await handleEmbeddings(request("/v1/embeddings", { model: "default", input }, "valid-key"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.model).toBe("gateway");
    expect(body.data.map((entry: { index: number; embedding: number[] }) => [entry.index, entry.embedding])).toEqual(vectors.map((vector, index) => [index, vector]));
  });
});

describe("evaluations", () => {
  it("requires gateway authentication", async () => {
    const response = await handleEvaluations(request("/v1/evaluations", {
      state: "A refund was issued.",
      questions: { refunded: { type: "boolean", instructions: "Was a refund issued?" } },
    }));
    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toMatch(/^req_/);
  });

  it.each([
    { state: "", questions: { valid: { type: "boolean", instructions: "Valid?" } } },
    { state: "some state", questions: {} },
    { state: "some state", questions: { invalid: { type: "choice", instructions: "Pick", criteria: { only: "one option" } } } },
    { state: "some state", questions: { invalid: { type: "score", instructions: "Rate", criteria: ["only one"] } } },
    { model: "typesafe-ai/jev", state: "some state", questions: { valid: { type: "boolean", instructions: "Valid?" } } },
  ])("rejects an invalid evaluation request", async (body) => {
    const response = await handleEvaluations(request("/v1/evaluations", body, "valid-key"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_request" } });
  });

  it("returns mixed Jev primitives without exposing provider internals", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      model: "typesafe-ai/jev",
      answers: {
        refunded: { type: "boolean", probability: 0.98 },
        route: { type: "choice", choice: "billing", probabilities: { billing: 0.9, support: 0.1 } },
        urgency: { type: "score", score: 1.8, probabilities: { "0": 0.01, "1": 0.18, "2": 0.81 } },
      },
      usage: { inputTokens: 30, outputTokens: 7 },
      providerMetadata: { gateway: { generationId: "gen_private", cost: "0" } },
    })));
    const response = await handleEvaluations(request("/v1/evaluations", {
      model: "gateway",
      state: { message: "I was charged twice and need a refund today." },
      questions: {
        refunded: { type: "boolean", instructions: "Is a refund requested?" },
        route: { type: "choice", instructions: "Route the request.", criteria: { billing: "Payment issues", support: "Other help" } },
        urgency: { type: "score", instructions: "Rate urgency.", criteria: ["low", "medium", "high"] },
      },
    }, "valid-key"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-request-id")).toMatch(/^req_/);
    expect(body).toMatchObject({
      model: "gateway",
      answers: {
        refunded: { type: "boolean", probability: 0.98 },
        route: { type: "choice", choice: "billing" },
        urgency: { type: "score", score: 1.8 },
      },
      usage: { input_tokens: 30, output_tokens: 7, total_tokens: 37 },
    });
    expect(JSON.stringify(body)).not.toContain("typesafe-ai/jev");
    expect(JSON.stringify(body)).not.toContain("gen_private");
  });
});

describe("sanitization and configuration", () => {
  it("does not expose provider errors or secrets", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "groq-secret raw upstream error" }), { status: 400 })));
    const response = await handleChat(request("/v1/chat/completions", { messages: [{ role: "user", content: "private prompt" }] }, "valid-key"));
    const serialized = JSON.stringify(await response.json());
    expect(response.status).toBe(400);
    expect(serialized).not.toContain("groq-secret");
    expect(serialized).not.toContain("raw upstream error");
  });

  it("returns a sanitized configuration error when a provider key is missing", async () => {
    delete process.env.GROQ_API_KEY;
    const response = await handleChat(request("/v1/chat/completions", { messages: [{ role: "user", content: "private prompt" }] }, "valid-key"));
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_configuration" } });
  });
});
