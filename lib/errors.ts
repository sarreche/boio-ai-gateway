import { ProviderFailure } from "@/lib/providers/types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly type: string,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function providerFailureToApiError(error: ProviderFailure): ApiError {
  if (error.kind === "client") return new ApiError(400, "invalid_request_error", "invalid_request", "The provider rejected the request");
  if (error.kind === "rate_limit") return new ApiError(429, "rate_limit_error", "rate_limit_exceeded", "All providers are currently rate limited");
  if (error.kind === "timeout") return new ApiError(504, "gateway_error", "provider_timeout", "All providers timed out");
  if (error.kind === "configuration") return new ApiError(500, "gateway_error", "invalid_configuration", "The gateway provider configuration is invalid");
  return new ApiError(502, "gateway_error", "provider_error", "All providers failed");
}

export function errorResponse(error: unknown, requestId: string): Response {
  const apiError = error instanceof ApiError
    ? error
    : new ApiError(500, "gateway_error", "internal_error", "An internal gateway error occurred");
  return Response.json({ error: { message: apiError.message, type: apiError.type, code: apiError.code } }, {
    status: apiError.status,
    headers: { "X-Request-Id": requestId },
  });
}
