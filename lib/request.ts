import { ApiError } from "@/lib/errors";

export const MAX_BODY_BYTES = 1024 * 1024;

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = request.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    throw new ApiError(400, "invalid_request_error", "request_too_large", "Request body exceeds 1 MB");
  }
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new ApiError(400, "invalid_request_error", "invalid_request", "Could not read request body");
  }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new ApiError(400, "invalid_request_error", "request_too_large", "Request body exceeds 1 MB");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, "invalid_request_error", "invalid_json", "Request body must be valid JSON");
  }
}
