import { describe, it, expect } from "vitest";
import { orient } from "../printReady/orient";
import type { Tri, Vec3 } from "../printPlan";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
function box(o: Vec3, s: Vec3): Tri[] {
  const p = [
    v(o.x, o.y, o.z), v(o.x + s.x, o.y, o.z), v(o.x + s.x, o.y + s.y, o.z), v(o.x, o.y + s.y, o.z),
    v(o.x, o.y, o.z + s.z), v(o.x + s.x, o.y, o.z + s.z), v(o.x + s.x, o.y + s.y, o.z + s.z), v(o.x, o.y + s.y, o.z + s.z),
  ];
  const quad = (a: number, b: number, c: number, d: number): Tri[] => [[p[a], p[b], p[c]], [p[a], p[c], p[d]]];
  return [...quad(0, 3, 2, 1), ...quad(4, 5, 6, 7), ...quad(0, 1, 5, 4), ...quad(1, 2, 6, 5), ...quad(2, 3, 7, 6), ...quad(0, 4, 7, 3)];
}

describe("orient", () => {
  it("lays a tall thin box down to minimize height", () => {
    const plan = orient(box(v(0, 0, 0), v(10, 10, 60)));
    expect(plan.heightMm).toBeLessThan(20); // laid flat (was 60 upright)
    // a 90° tip about x or y
    expect(Math.abs(plan.rotation.x) === 90 || Math.abs(plan.rotation.y) === 90).toBe(true);
    expect(plan.why.length).toBeGreaterThan(0);
    expect(plan.label.length).toBeGreaterThan(0);
  });

  it("keeps an already-flat slab as-is", () => {
    const plan = orient(box(v(0, 0, 0), v(60, 60, 5)));
    expect(plan.rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(plan.heightMm).toBeCloseTo(5, 1);
  });
});
