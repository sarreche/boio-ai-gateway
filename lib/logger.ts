export interface LogEvent {
  requestId: string;
  endpoint: "chat" | "embeddings" | "evaluations";
  provider: string;
  durationMs: number;
  status: "success" | "error";
  fallbackUsed: boolean;
}

export function logProviderAttempt(event: LogEvent): void {
  console.info(JSON.stringify(event));
}
