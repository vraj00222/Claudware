import { describe, it, expect } from "vitest";
import { enginePrimer } from "../skills";

describe("enginePrimer", () => {
  it("gives Fusion the cad-modeling feature-order + parametric guidance", () => {
    const p = enginePrimer("fusion");
    expect(p.length).toBeGreaterThan(40);
    expect(p).toMatch(/fillet|feature|parametric|sketch/i);
  });

  it("gives Blender printable-mesh (manifold) guidance", () => {
    const p = enginePrimer("blender");
    expect(p.length).toBeGreaterThan(40);
    expect(p).toMatch(/manifold|watertight|printable|modifier/i);
  });

  it("gives OpenSCAD the BOSL2 primer", () => {
    expect(enginePrimer("openscad")).toMatch(/BOSL2/i);
  });

  it("returns empty for NVIDIA (enrichment is its skill, not a code primer)", () => {
    expect(enginePrimer("nvidia")).toBe("");
  });
});
