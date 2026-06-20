import { describe, it, expect } from "vitest";
import { resolveBin } from "@/server/bin";

describe("resolveBin", () => {
  it("prefers an existing env override", () => {
    process.env.TEST_BIN_OVERRIDE = "/usr/bin/env"; // exists on Linux/macOS CI
    expect(resolveBin("nope", ["/no/such/path"], "TEST_BIN_OVERRIDE")).toBe("/usr/bin/env");
    delete process.env.TEST_BIN_OVERRIDE;
  });

  it("ignores a non-existent env override and uses the first existing candidate", () => {
    process.env.TEST_BIN_OVERRIDE = "/definitely/not/here";
    expect(resolveBin("name", ["/no/such/path", "/usr/bin/env"], "TEST_BIN_OVERRIDE")).toBe("/usr/bin/env");
    delete process.env.TEST_BIN_OVERRIDE;
  });

  it("falls back to the bare name when nothing on disk matches (PATH resolution)", () => {
    expect(resolveBin("openscad", ["/no/such/openscad", "/also/missing"])).toBe("openscad");
  });

  it("returns the first candidate that exists", () => {
    expect(resolveBin("blender", ["/no/such/path", "/usr/bin/env", "/bin/sh"])).toBe("/usr/bin/env");
  });
});
