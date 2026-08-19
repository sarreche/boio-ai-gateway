import { randomUUID } from "node:crypto";
import { isAuthorized } from "@/lib/auth";
import { ApiError, errorResponse, providerFailureToApiError } from "@/lib/errors";
import { ProviderFailure } from "@/lib/providers/types";
import { readJsonBody } from "@/lib/request";
import { routeChat, routeEmbeddings } from "@/lib/routing";
import { chatRequestSchema } from "@/lib/schemas/chat";
import { embeddingsRequestSchema } from "@/lib/schemas/embeddings";

function unauthorized(requestId: string): Response {
  return errorResponse(new ApiError(401, "authentication_error", "invalid_api_key", "Invalid API key"), requestId);
}

function normalizeCaught(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof ProviderFailure) return providerFailureToApiError(error);
  return new ApiError(500, "gateway_error", "invalid_configuration", "The gateway configuration is invalid");
}

export async function handleChat(request: Request): Promise<Response> {
  const requestId = `req_${randomUUID()}`;
  if (!isAuthorized(request)) return unauthorized(requestId);
  try {
    const body = await readJsonBody(request);
    if (typeof body === "object" && body !== null && "stream" in body && body.stream === true) {
      throw new ApiError(400, "invalid_request_error", "unsupported_streaming", "Streaming is not supported");
    }
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(400, "invalid_request_error", "invalid_request", "Invalid chat completion request");
    const result = await routeChat(parsed.data, requestId);
    return Response.json({
      id: `chatcmpl_${randomUUID()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: "gateway",
      choices: [{ index: 0, message: { role: "assistant", content: result.content }, finish_reason: result.finishReason }],
      ...(result.usage ? { usage: result.usage } : {}),
    }, { headers: { "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(normalizeCaught(error), requestId);
  }
}

export async function handleEmbeddings(request: Request): Promise<Response> {
  const requestId = `req_${randomUUID()}`;
  if (!isAuthorized(request)) return unauthorized(requestId);
  try {
    const parsed = embeddingsRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new ApiError(400, "invalid_request_error", "invalid_request", "Invalid embeddings request");
    const result = await routeEmbeddings(parsed.data, requestId);
    return Response.json({
      object: "list",
      data: result.embeddings.map((embedding, index) => ({ object: "embedding", index, embedding })),
      model: "gateway",
      ...(result.usage ? { usage: result.usage } : {}),
    }, { headers: { "X-Request-Id": requestId } });
  } catch (error) {
    return errorResponse(normalizeCaught(error), requestId);
  }
}
