import { describe, it, expect } from "vitest";
import { ALL_DEMO_PROMPTS, getPromptsForEngine, getDemoSequence, HERO_PROMPTS, QUICK_PRINTS } from "@/lib/demoPrompts";

describe("demoPrompts", () => {
  it("has at least 15 curated prompts", () => {
    expect(ALL_DEMO_PROMPTS.length).toBeGreaterThanOrEqual(15);
  });

  it("every prompt has all required fields", () => {
    for (const p of ALL_DEMO_PROMPTS) {
      expect(p.prompt.length).toBeGreaterThan(5);
      expect(["blender", "openscad", "fusion", "nvidia", "auto"]).toContain(p.engine);
      expect(["hero", "functional", "art", "mechanical", "quick_win"]).toContain(p.category);
      expect(p.printTimeMin).toBeGreaterThan(0);
      expect(p.notes.length).toBeGreaterThan(5);
    }
  });

  it("has hero prompts for demo start", () => {
    expect(HERO_PROMPTS.length).toBeGreaterThanOrEqual(3);
  });

  it("has quick prints under 15 min", () => {
    expect(QUICK_PRINTS.length).toBeGreaterThanOrEqual(3);
    for (const p of QUICK_PRINTS) {
      expect(p.printTimeMin).toBeLessThanOrEqual(15);
    }
  });

  it("getPromptsForEngine returns engine-specific prompts", () => {
    const blender = getPromptsForEngine("blender");
    expect(blender.length).toBeGreaterThan(0);
    expect(blender.every((p) => p.engine === "blender")).toBe(true);

    const openscad = getPromptsForEngine("openscad");
    expect(openscad.length).toBeGreaterThan(0);
    expect(openscad.every((p) => p.engine === "openscad")).toBe(true);
  });

  it("getDemoSequence starts with hero prompts", () => {
    const seq = getDemoSequence();
    expect(seq.length).toBeGreaterThanOrEqual(3);
    expect(seq[0].category).toBe("hero");
  });
});
