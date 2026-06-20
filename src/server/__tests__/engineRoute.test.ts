import { describe, it, expect } from "vitest";
import { classifyEngine, resolveEngine } from "../engineRoute";

describe("classifyEngine", () => {
  it("routes characters / creatures / figures to NVIDIA", () => {
    expect(classifyEngine("a chubby sitting dragon").engine).toBe("nvidia");
    expect(classifyEngine("god of war kratos").engine).toBe("nvidia");
    expect(classifyEngine("an anime figurine of a knight").engine).toBe("nvidia");
    expect(classifyEngine("a cute robot mascot").engine).toBe("nvidia");
  });

  it("keeps a character on NVIDIA even when a mechanical word appears", () => {
    // 'gear' would otherwise pull this to OpenSCAD — the character signal must win.
    expect(classifyEngine("luffy in gear 2 pose").engine).toBe("nvidia");
  });

  it("treats an organic descriptor as the wow path even with a structure word", () => {
    // Vraj's favourite: 'mushroom house' should be the textured NVIDIA output, not an OpenSCAD box.
    expect(classifyEngine("a cute mushroom house").engine).toBe("nvidia");
  });

  it("routes mechanical / parametric parts to OpenSCAD", () => {
    expect(classifyEngine("24-tooth herringbone gear with a hex bore").engine).toBe("openscad");
    expect(classifyEngine("a phone stand bracket").engine).toBe("openscad");
    expect(classifyEngine("an enclosure for a raspberry pi").engine).toBe("openscad");
    expect(classifyEngine("an M8 threaded rod").engine).toBe("openscad");
  });

  it("routes simple shapes to OpenSCAD", () => {
    expect(classifyEngine("a coffee mug").engine).toBe("openscad");
    expect(classifyEngine("a 50mm box").engine).toBe("openscad");
  });

  it("routes explicit 'in blender' / 'watch it build' to Blender", () => {
    expect(classifyEngine("watch a small rocket build in blender").engine).toBe("blender");
    expect(classifyEngine("build a tree in blender").engine).toBe("blender");
  });

  it("falls back to NVIDIA for unknown subjects (better a textured attempt than a block)", () => {
    expect(classifyEngine("a spaceship").engine).toBe("nvidia");
  });

  it("returns a human reason for the pick", () => {
    expect(classifyEngine("a chubby sitting dragon").reason).toMatch(/character|organic|figure|creature/i);
    expect(classifyEngine("24-tooth gear").reason).toMatch(/mechanical|parametric|part/i);
  });
});

describe("resolveEngine", () => {
  it("auto resolves via the classifier", () => {
    expect(resolveEngine("auto", "a chubby sitting dragon").engine).toBe("nvidia");
    expect(resolveEngine("auto", "a 24-tooth gear").engine).toBe("openscad");
  });

  it("a manual pick always wins over the prompt", () => {
    expect(resolveEngine("openscad", "a chubby sitting dragon").engine).toBe("openscad");
    expect(resolveEngine("fusion", "a chubby sitting dragon").engine).toBe("fusion");
    expect(resolveEngine("nvidia", "a 24-tooth gear").engine).toBe("nvidia");
  });

  it("a manual pick marks itself as user-chosen in the reason", () => {
    expect(resolveEngine("fusion", "anything").reason).toMatch(/chose|you/i);
  });
});
