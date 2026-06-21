import { describe, it, expect } from "vitest";
import { canonicalDescriptor, outfitClause, webResearchImage } from "@/server/promptEnrich";

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

  it("composes outfits onto the mascot (the cowboy ask)", () => {
    const d = canonicalDescriptor("generate the claude code mascot in a cowboy hat");
    expect(d).toMatch(/Clawd/);
    expect(d).toMatch(/cowboy hat/);
    expect(d).toMatch(/bandana/);
  });

  it("composes themed + loose accessories together", () => {
    const d = canonicalDescriptor("Clawd as a wizard with sunglasses");
    expect(d).toMatch(/wizard hat/);
    expect(d).toMatch(/sunglasses/);
  });
});

describe("outfitClause", () => {
  it("returns themed costume for a known outfit", () => {
    expect(outfitClause("in a cowboy hat")).toMatch(/cowboy hat.*bandana/);
    expect(outfitClause("as a santa")).toMatch(/Santa hat/);
    expect(outfitClause("astronaut")).toMatch(/astronaut helmet/);
  });

  it("does not double up headwear when a themed outfit already implies a hat", () => {
    const c = outfitClause("a cowboy with a hat");
    expect(c).toMatch(/cowboy hat/);
    expect(c).not.toMatch(/a little hat/);
  });

  it("returns empty for no accessory", () => {
    expect(outfitClause("sitting upright")).toBe("");
  });

  it("falls back to a generic hat when only 'hat' is mentioned", () => {
    expect(outfitClause("wearing a hat")).toMatch(/a little hat/);
  });
});

describe("webResearchImage", () => {
  it("returns null when Browserbase is not configured (no API key)", async () => {
    const result = await webResearchImage("Tesla Optimus robot", "/tmp");
    expect(result).toBeNull();
  });
});
