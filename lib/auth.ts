import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value: string) => createHash("sha256").update(value).digest();

export function isAuthorized(request: Request, env: Readonly<Record<string, string | undefined>> = process.env): boolean {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7).trim();
  if (!token) return false;
  return (env.GATEWAY_API_KEYS ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
    .some((key) => timingSafeEqual(digest(token), digest(key)));
}
