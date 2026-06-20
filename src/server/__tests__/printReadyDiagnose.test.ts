import { describe, it, expect } from "vitest";
import { countOpenEdges, countShells, shellBBoxes, overhangFraction, diagnose } from "../printReady/diagnose";
import { BAMBU_A1 } from "../printReady/bed";
import type { Tri, Vec3 } from "../printPlan";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** A CLOSED axis-aligned box (12 triangles) with verified OUTWARD-facing normals. */
function box(o: Vec3, s: Vec3): Tri[] {
  const p = [
    v(o.x, o.y, o.z), v(o.x + s.x, o.y, o.z), v(o.x + s.x, o.y + s.y, o.z), v(o.x, o.y + s.y, o.z),
    v(o.x, o.y, o.z + s.z), v(o.x + s.x, o.y, o.z + s.z), v(o.x + s.x, o.y + s.y, o.z + s.z), v(o.x, o.y + s.y, o.z + s.z),
  ];
  const quad = (a: number, b: number, c: number, d: number): Tri[] => [[p[a], p[b], p[c]], [p[a], p[c], p[d]]];
  return [
    ...quad(0, 3, 2, 1), // bottom (−z)
    ...quad(4, 5, 6, 7), // top (+z)
    ...quad(0, 1, 5, 4), // front (−y)
    ...quad(1, 2, 6, 5), // right (+x)
    ...quad(2, 3, 7, 6), // back (+y)
    ...quad(0, 4, 7, 3), // left (−x)
  ];
}

describe("BAMBU_A1 bed", () => {
  it("is the real Bambu A1 build volume + nozzle", () => {
    expect(BAMBU_A1.w).toBe(256);
    expect(BAMBU_A1.d).toBe(256);
    expect(BAMBU_A1.h).toBe(256);
    expect(BAMBU_A1.nozzle).toBe(0.4);
  });
});

describe("countOpenEdges", () => {
  it("is 0 for a watertight box", () => {
    expect(countOpenEdges(box(v(0, 0, 0), v(10, 10, 10)))).toBe(0);
  });
  it("counts the boundary edges of a hole (a removed face)", () => {
    const holed = box(v(0, 0, 0), v(10, 10, 10)).slice(0, 10); // drop the 2 left-face triangles
    expect(countOpenEdges(holed)).toBe(4);
  });
});

describe("countShells / shellBBoxes", () => {
  it("a single box is one shell", () => {
    expect(countShells(box(v(0, 0, 0), v(10, 10, 10)))).toBe(1);
  });
  it("two disjoint boxes are two shells (floaters)", () => {
    expect(countShells([...box(v(0, 0, 0), v(10, 10, 10)), ...box(v(50, 0, 0), v(10, 10, 10))])).toBe(2);
  });
  it("shellBBoxes returns one bbox sized to the box", () => {
    const bb = shellBBoxes(box(v(0, 0, 0), v(10, 12, 8)));
    expect(bb).toHaveLength(1);
    expect(bb[0].w).toBeCloseTo(10);
    expect(bb[0].h).toBeCloseTo(8);
  });
});

describe("overhangFraction", () => {
  it("is ~0 for a box sitting flat on the plate", () => {
    expect(overhangFraction(box(v(0, 0, 0), v(10, 10, 10)))).toBeLessThan(0.05);
  });
  it("is high when a downward-facing face floats above the plate", () => {
    // a base tri at z=0 + an elevated downward tri at z=10
    const base: Tri = [v(0, 0, 0), v(10, 0, 0), v(0, 10, 0)];
    const ceil: Tri = [v(0, 0, 10), v(0, 10, 10), v(10, 0, 10)]; // normal points down (−z)
    expect(overhangFraction([base, ceil])).toBeGreaterThan(0.3);
  });
});

describe("diagnose", () => {
  it("passes a clean 10mm box (ready)", () => {
    const d = diagnose(box(v(0, 0, 0), v(10, 10, 10)), BAMBU_A1);
    expect(d.grade).toBe("ready");
    expect(d.score).toBeGreaterThanOrEqual(85);
    expect(d.checks.find((c) => c.id === "manifold")!.level).toBe("ok");
    expect(d.checks.find((c) => c.id === "floaters")!.level).toBe("ok");
  });
  it("flags a paper-thin part", () => {
    const d = diagnose(box(v(0, 0, 0), v(20, 20, 0.6)), BAMBU_A1);
    const thin = d.checks.find((c) => c.id === "thin")!;
    expect(thin.level).not.toBe("ok");
  });
  it("flags an open (non-watertight) mesh", () => {
    const d = diagnose(box(v(0, 0, 0), v(10, 10, 10)).slice(0, 10), BAMBU_A1);
    expect(d.checks.find((c) => c.id === "manifold")!.level).not.toBe("ok");
    expect(d.score).toBeLessThan(100);
  });
});
