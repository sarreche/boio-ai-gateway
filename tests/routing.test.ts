import { beforeEach, describe, expect, it, vi } from "vitest";
import { route } from "@/lib/routing";
import { ProviderFailure } from "@/lib/providers/types";

const provider = (id: string) => ({ id });

beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));

describe("priority routing", () => {
  it("stops after the first provider succeeds", async () => {
    const invoke = vi.fn().mockResolvedValue("ok");
    await expect(route("chat", [provider("one"), provider("two")], "req_1", invoke)).resolves.toBe("ok");
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it.each([
    new ProviderFailure("rate_limit", 429),
    new ProviderFailure("provider", 500),
    new ProviderFailure("timeout"),
    new ProviderFailure("network"),
  ])("falls back for recoverable failures", async (failure) => {
    const invoke = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce("fallback");
    await expect(route("chat", [provider("one"), provider("two")], "req_1", invoke)).resolves.toBe("fallback");
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("does not fall back on a client error", async () => {
    const invoke = vi.fn().mockRejectedValue(new ProviderFailure("client", 400));
    await expect(route("chat", [provider("one"), provider("two")], "req_1", invoke)).rejects.toMatchObject({ kind: "client" });
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("returns provider_error semantics when every provider fails", async () => {
    const invoke = vi.fn().mockRejectedValue(new ProviderFailure("provider", 503));
    await expect(route("chat", [provider("one"), provider("two")], "req_1", invoke)).rejects.toMatchObject({ kind: "provider" });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("logs metadata without request contents", async () => {
    const log = vi.mocked(console.info);
    await route("chat", [provider("one")], "req_safe", async () => "private prompt");
    const output = String(log.mock.calls[0][0]);
    expect(output).toContain("req_safe");
    expect(output).not.toContain("private prompt");
  });
});
