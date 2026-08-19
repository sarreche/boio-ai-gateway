import { describe, expect, it } from "vitest";
import { GET } from "@/app/health/route";

describe("health", () => {
  it("returns only public health status", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});
