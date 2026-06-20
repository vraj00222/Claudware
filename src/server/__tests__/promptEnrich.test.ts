import { describe, it, expect } from "vitest";
import { canonicalDescriptor, webResearchImage } from "@/server/promptEnrich";

describe("canonicalDescriptor (named-subject stopgap)", () => {
  it("matches explicit Claude-mascot namings", () => {
    for (const p of [
      "the claude code mascot",
      "Clawd in a black hat",
      "make a Claude mascot figurine",
      "anthropic mascot, sitting",
      "use the claude code mascot from the reference image",
    ]) {
      expect(canonicalDescriptor(p), p).toMatch(/Clawd|coral-orange/);
    }
  });

  it("does NOT hijack unrelated prompts (incl. a bare 'claude')", () => {
    for (const p of ["a dragon", "claude shannon bust", "a cowboy hat", "god of war kratos", "a coffee mug"]) {
      expect(canonicalDescriptor(p), p).toBe("");
    }
  });
});

describe("webResearchImage", () => {
  it("returns null when Browserbase is not configured (no API key)", async () => {
    const result = await webResearchImage("Tesla Optimus robot", "/tmp");
    expect(result).toBeNull();
  });
});
