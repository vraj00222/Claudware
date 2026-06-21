import { describe, it, expect } from "vitest";
import {
  parseStlTriangles, boundingBox, analyzeOverhangs, computeSupportPillars, planSplit, DEFAULT_BED,
  buildPrintPlan,
  type Tri,
} from "../printPlan";

// minimal ASCII STL whose vertices touch (0,0,0) and (10,20,30) → bbox 10×20×30.
const STL = `solid t
 facet normal 0 0 1
  outer loop
   vertex 0 0 0
   vertex 10 0 0
   vertex 0 20 0
  endloop
 endfacet
 facet normal 0 0 1
  outer loop
   vertex 10 20 30
   vertex 0 0 30
   vertex 10 0 30
  endloop
 endfacet
endsolid t`;

describe("parseStlTriangles", () => {
  it("parses every facet as 3 vertices", () => {
    const tris = parseStlTriangles(STL);
    expect(tris).toHaveLength(2);
    expect(tris[0][0]).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe("parseStlTriangles — scientific notation", () => {
  // CAD exporters (e.g. Prusa's own parts) emit near-zero coords as -5.05151e-015.
  // The `-` in the exponent must be captured, else Number("...e") → NaN poisons the estimate.
  const SCI = `solid s
 facet normal 0 0 1
  outer loop
   vertex 22.75 27 -5.05151e-015
   vertex 26.75 27 -5.93969e-015
   vertex 22.75 28 1.5e+001
  endloop
 endfacet
endsolid s`;
  it("parses negative-exponent vertices as finite numbers", () => {
    const tris = parseStlTriangles(SCI);
    expect(tris).toHaveLength(1);
    for (const v of tris[0]) {
      expect(Number.isFinite(v.x)).toBe(true);
      expect(Number.isFinite(v.y)).toBe(true);
      expect(Number.isFinite(v.z)).toBe(true);
    }
    expect(tris[0][2].z).toBeCloseTo(15, 5); // 1.5e+001
  });
});

describe("boundingBox", () => {
  it("measures W×D×H from the extremes", () => {
    const bb = boundingBox(parseStlTriangles(STL));
    expect(bb.w).toBe(10);
    expect(bb.d).toBe(20);
    expect(bb.h).toBe(30);
  });
  it("returns zeros for empty geometry", () => {
    expect(boundingBox([])).toMatchObject({ w: 0, d: 0, h: 0 });
  });
});

const up = (z: number): Tri => [ { x: 0, y: 0, z }, { x: 10, y: 0, z }, { x: 0, y: 10, z } ];     // normal +Z
const down = (z: number): Tri => [ { x: 0, y: 0, z }, { x: 0, y: 10, z }, { x: 10, y: 0, z } ];   // normal -Z

describe("analyzeOverhangs", () => {
  it("flags no support for an upward face", () => {
    expect(analyzeOverhangs([up(0), up(5)]).needed).toBe(false);
  });
  it("ignores the base (downward face resting on the plate)", () => {
    expect(analyzeOverhangs([down(0), up(0)]).needed).toBe(false);
  });
  it("flags support for an elevated downward face (ceiling/overhang)", () => {
    expect(analyzeOverhangs([up(0), down(20)]).needed).toBe(true);
  });
});

// a small downward-facing facet (normal -Z) centered near (x,y) at height z → an overhang.
const downAt = (x: number, y: number, z: number): Tri =>
  [ { x, y, z }, { x, y: y + 2, z }, { x: x + 2, y, z } ];

describe("computeSupportPillars", () => {
  it("emits no pillars for grounded / support-free geometry", () => {
    expect(computeSupportPillars([up(0), down(0)]).pillars).toHaveLength(0);
  });
  it("drops pillars under elevated overhangs, based at the model floor", () => {
    // a 'tabletop on legs': downward roof faces at z=40 over two footprints; floor at z=0.
    const { pillars, baseZ } = computeSupportPillars([up(0), downAt(0, 0, 40), downAt(30, 0, 40)]);
    expect(pillars.length).toBeGreaterThanOrEqual(2);
    expect(baseZ).toBe(0);
    for (const p of pillars) expect(p.topZ).toBeCloseTo(40, 1);
  });
  it("clusters many overhang faces into a sane grid-snapped set", () => {
    const tris: Tri[] = [up(0)];
    for (let i = 0; i < 60; i++) tris.push(downAt(i * 0.1, 0, 30)); // 60 faces in a ~5mm footprint
    const { pillars } = computeSupportPillars(tris);
    expect(pillars.length).toBeGreaterThan(0);
    expect(pillars.length).toBeLessThan(60);
  });
  it("caps the number of pillars on dense overhang fields", () => {
    const tris: Tri[] = [up(0)];
    for (let i = 0; i < 50; i++) for (let j = 0; j < 50; j++) tris.push(downAt(i * 6, j * 6, 25));
    const { pillars } = computeSupportPillars(tris); // 2500 cells → capped at 200
    expect(pillars.length).toBeLessThanOrEqual(200);
  });
});

const bb = (w: number, d: number, h: number) =>
  ({ w, d, h, min: { x: 0, y: 0, z: 0 }, max: { x: w, y: d, z: h } });

describe("planSplit", () => {
  it("recommends one piece when it fits", () => {
    const p = planSplit(bb(100, 100, 100), DEFAULT_BED);
    expect(p.recommendation).toBe("one_piece");
    expect(p.seams).toHaveLength(0);
    expect(p.parts).toHaveLength(1);
  });
  it("splits the longest over-bed axis into fitting slabs", () => {
    const p = planSplit(bb(500, 90, 90), DEFAULT_BED); // 500 > 218 usable → ceil(500/218)=3
    expect(p.recommendation).toBe("split");
    expect(p.parts).toHaveLength(3);
    expect(p.seams).toHaveLength(2);
    expect(p.seams[0].axis).toBe("x");
    expect(p.parts[0].w).toBeCloseTo(500 / 3, 1);
  });
});

describe("buildPrintPlan", () => {
  it("composes dimensions, split, supports, and download urls", () => {
    const plan = buildPrintPlan(STL, DEFAULT_BED, { stlUrl: "/generated/x/final.stl" });
    expect(plan.dimensions).toEqual({ w: 10, d: 20, h: 30 });
    expect(plan.recommendation).toBe("one_piece");
    expect(plan.download.stlUrl).toBe("/generated/x/final.stl");
    expect(typeof plan.supports.needed).toBe("boolean");
  });
});
