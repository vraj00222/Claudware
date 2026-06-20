import { describe, it, expect, vi } from "vitest";
import { bambuConfigured, bambuReachable } from "@/server/bambuPrint";

describe("bambuConfigured", () => {
  it("returns false when env vars are not set", () => {
    expect(bambuConfigured()).toBe(false);
  });

  it("returns true when all env vars are set", () => {
    vi.stubEnv("BAMBU_PRINTER_IP", "192.168.1.42");
    vi.stubEnv("BAMBU_ACCESS_CODE", "12345678");
    vi.stubEnv("BAMBU_SERIAL", "01P00A000000001");
    expect(bambuConfigured()).toBe(true);
    vi.unstubAllEnvs();
  });
});

describe("bambuReachable", () => {
  it("returns false when not configured", async () => {
    const r = await bambuReachable(500);
    expect(r).toBe(false);
  });
});
