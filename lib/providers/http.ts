import { ProviderFailure } from "@/lib/providers/types";

export async function providerFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      if (response.status === 408 || response.status === 429) throw new ProviderFailure(response.status === 429 ? "rate_limit" : "timeout", response.status);
      if (response.status >= 500) throw new ProviderFailure("provider", response.status);
      if (response.status === 401 || response.status === 403) throw new ProviderFailure("configuration", response.status);
      throw new ProviderFailure("client", response.status);
    }
    return response;
  } catch (error) {
    if (error instanceof ProviderFailure) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new ProviderFailure("timeout");
    throw new ProviderFailure("network");
  } finally {
    clearTimeout(timer);
  }
}

export async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ProviderFailure("provider", response.status);
  }
}
