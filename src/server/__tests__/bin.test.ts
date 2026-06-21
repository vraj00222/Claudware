import { describe, it, expect, afterEach } from "vitest";
import { resolveBin, resolveBinOrNull, resolveSlicerBin } from "@/server/bin";

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

  it("skips directories and non-executable paths", () => {
    expect(resolveBin("blender", ["/usr", "/tmp", "/usr/bin/env"])).toBe("/usr/bin/env");
  });
});

describe("resolveBinOrNull (clear not-available signal)", () => {
  afterEach(() => { delete process.env.TEST_BIN_OVERRIDE; });

  it("prefers an existing env override", () => {
    process.env.TEST_BIN_OVERRIDE = "/usr/bin/env";
    expect(resolveBinOrNull("nope", ["/no/such/path"], "TEST_BIN_OVERRIDE")).toBe("/usr/bin/env");
  });

  it("returns the first existing candidate", () => {
    expect(resolveBinOrNull("blender", ["/no/such/path", "/usr/bin/env"])).toBe("/usr/bin/env");
  });

  it("resolves a bare name via $PATH when no candidate matches", () => {
    const got = resolveBinOrNull("env", []);
    expect(got).not.toBeNull();
    expect(got!.endsWith("/env")).toBe(true);
  });

  it("returns null when nothing matches on disk OR $PATH", () => {
    expect(resolveBinOrNull("definitely-not-a-real-binary-xyz", ["/no/such/path"])).toBeNull();
  });
});

describe("resolveSlicerBin", () => {
  afterEach(() => { delete process.env.SLICER_BIN; });

  it("honours the SLICER_BIN env override when it points at a real executable", () => {
    process.env.SLICER_BIN = "/usr/bin/env";
    expect(resolveSlicerBin()).toBe("/usr/bin/env");
  });

  it("returns either a resolved path or null (never the bare name) depending on install", () => {
    // Environment-agnostic: when a slicer is installed it returns its full path; otherwise null.
    const got = resolveSlicerBin();
    expect(got === null || got.startsWith("/")).toBe(true);
  });
});
