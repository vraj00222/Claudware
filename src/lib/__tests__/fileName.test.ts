import { describe, it, expect } from "vitest";
import { modelSlug, modelFileName } from "../fileName";

describe("modelSlug", () => {
  it("slugifies a prompt into a safe file base", () => {
    expect(modelSlug("Cute Dragon")).toBe("cute-dragon");
    expect(modelSlug("a small dragon figurine")).toBe("a-small-dragon-figurine");
  });
  it("drops quotes and collapses punctuation/whitespace", () => {
    expect(modelSlug('"lego" mug')).toBe("lego-mug");
    expect(modelSlug("phone case — iPhone 15!!")).toBe("phone-case-iphone-15");
  });
  it("trims leading/trailing hyphens and caps length", () => {
    expect(modelSlug("  ...hello...  ")).toBe("hello");
    const long = modelSlug("x".repeat(200));
    expect(long.length).toBeLessThanOrEqual(60);
  });
  it("falls back when the name is empty or unusable", () => {
    expect(modelSlug("")).toBe("model");
    expect(modelSlug(null)).toBe("model");
    expect(modelSlug("###")).toBe("model");
    expect(modelSlug("###", "part-1")).toBe("part-1");
  });
});

describe("modelFileName", () => {
  it("appends the extension to the slug", () => {
    expect(modelFileName("Cute Dragon", "stl")).toBe("cute-dragon.stl");
    expect(modelFileName("Cute Dragon", "3mf")).toBe("cute-dragon.3mf");
  });
  it("tolerates a leading dot in the extension", () => {
    expect(modelFileName("Cute Dragon", ".obj")).toBe("cute-dragon.obj");
  });
  it("uses the model fallback for empty names", () => {
    expect(modelFileName(null, "stl")).toBe("model.stl");
  });
});
