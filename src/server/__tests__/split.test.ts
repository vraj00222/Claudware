import { describe, it, expect } from "vitest";
import { planSplitParts, planConnector, buildPartScad, type SplitPlan } from "@/server/split";
import type { BBox } from "@/server/printPlan";

/** Build an axis-aligned BBox from explicit extents (min at origin). */
function box(w: number, d: number, h: number): BBox {
  return { w, d, h, min: { x: 0, y: 0, z: 0 }, max: { x: w, y: d, z: h } };
}

describe("planSplitParts — AUTO (exceeds bed)", () => {
  it("splits the worst axis into bed-sized slabs", () => {
    const plan = planSplitParts(box(30, 30, 300)); // default bed 220×220×250
    expect(plan).not.toBeNull();
    expect(plan!.mode).toBe("auto");
    expect(plan!.axis).toBe("z");
    expect(plan!.parts).toHaveLength(2); // ceil(300 / 248)
    expect(plan!.seams).toHaveLength(1);
    expect(plan!.seams[0]).toBeCloseTo(150, 1);
  });

  it("returns null when the model fits the bed", () => {
    expect(planSplitParts(box(60, 60, 60))).toBeNull();
  });
});

describe("planSplitParts — FORCED (the print-in-parts version)", () => {
  it("splits a fitting model into N parts along its longest axis", () => {
    const plan = planSplitParts(box(40, 40, 120), { parts: 3 });
    expect(plan!.mode).toBe("forced");
    expect(plan!.axis).toBe("z");
    expect(plan!.parts).toHaveLength(3);
    expect(plan!.seams).toEqual([40, 80]);
    // contiguous, non-overlapping slabs covering the whole height
    expect(plan!.parts[0]).toMatchObject({ lo: 0, hi: 40 });
    expect(plan!.parts[2]).toMatchObject({ lo: 80, hi: 120 });
  });

  it("ignores a parts request of < 2", () => {
    expect(planSplitParts(box(40, 40, 120), { parts: 1 })).toBeNull();
  });
});

describe("planConnector — push-fit tolerances (no compromise)", () => {
  it("socket = peg + clearance, default clearance 0.2mm", () => {
    const c = planConnector(box(40, 40, 120), "z", 0.2);
    expect(c.type).toBe("push-fit");
    expect(c.clearance).toBe(0.2);
    expect(c.socketDiameter).toBeCloseTo(c.pegDiameter + 0.2, 5);
    expect(c.pegDiameter).toBeGreaterThanOrEqual(4);
    expect(c.pegDiameter).toBeLessThanOrEqual(12);
    expect(c.socketDepth).toBeGreaterThan(c.pegLength);
  });

  it("honors a custom clearance", () => {
    const c = planConnector(box(40, 40, 120), "z", 0.15);
    expect(c.clearance).toBe(0.15);
    expect(c.socketDiameter).toBeCloseTo(c.pegDiameter + 0.15, 5);
  });

  it("scales peg count with cross-section size", () => {
    expect(planConnector(box(15, 15, 100), "z", 0.2).positions).toHaveLength(1); // tiny
    expect(planConnector(box(40, 40, 100), "z", 0.2).positions).toHaveLength(2); // medium
    expect(planConnector(box(90, 90, 100), "z", 0.2).positions).toHaveLength(4); // large
  });

  it("places pegs toward the centre of the cross-section", () => {
    const c = planConnector(box(40, 40, 120), "z", 0.2);
    for (const p of c.positions) {
      expect(p.a).toBeGreaterThan(4);
      expect(p.a).toBeLessThan(36);
      expect(p.b).toBeGreaterThan(4);
      expect(p.b).toBeLessThan(36);
    }
  });
});

describe("buildPartScad — connector placement per part", () => {
  const bbox = box(40, 40, 120);
  const plan = planSplitParts(bbox, { parts: 3 }) as SplitPlan;

  it("first part has pegs (male) but no sockets", () => {
    const scad = buildPartScad("model.stl", plan, bbox, plan.parts[0]);
    expect(scad).toContain('import("model.stl")');
    expect(scad).toContain("intersection()");
    expect(scad).toContain("union()"); // pegs unioned on
    expect(scad).not.toContain("difference()"); // no sockets on the first part
  });

  it("last part has sockets (female) but no pegs", () => {
    const scad = buildPartScad("model.stl", plan, bbox, plan.parts[2]);
    expect(scad).toContain("difference()"); // sockets cut out
    expect(scad).not.toContain("union()"); // no pegs on the last part
  });

  it("a middle part has both pegs and sockets", () => {
    const scad = buildPartScad("model.stl", plan, bbox, plan.parts[1]);
    expect(scad).toContain("difference()");
    expect(scad).toContain("union()");
  });
});
