import { describe, it, expect } from "vitest";
import { buildPrintReadiness } from "../printReady/readiness";
import { BAMBU_A1 } from "../printReady/bed";
import type { Tri, Vec3 } from "../printPlan";
import type { ExportFormat } from "@/lib/agentEvent";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
function box(o: Vec3, s: Vec3): Tri[] {
  const p = [
    v(o.x, o.y, o.z), v(o.x + s.x, o.y, o.z), v(o.x + s.x, o.y + s.y, o.z), v(o.x, o.y + s.y, o.z),
    v(o.x, o.y, o.z + s.z), v(o.x + s.x, o.y, o.z + s.z), v(o.x + s.x, o.y + s.y, o.z + s.z), v(o.x, o.y + s.y, o.z + s.z),
  ];
  const quad = (a: number, b: number, c: number, d: number): Tri[] => [[p[a], p[b], p[c]], [p[a], p[c], p[d]]];
  return [...quad(0, 3, 2, 1), ...quad(4, 5, 6, 7), ...quad(0, 1, 5, 4), ...quad(1, 2, 6, 5), ...quad(2, 3, 7, 6), ...quad(0, 4, 7, 3)];
}
const fmts: ExportFormat[] = [
  { format: "stl", url: "/x/model.stl", label: "STL" },
  { format: "obj", url: "/x/model.obj", label: "OBJ" },
  { format: "3mf", url: "/x/model.3mf", label: "3MF (Bambu A1)" },
];

describe("buildPrintReadiness", () => {
  it("a clean small box is ready and prints in one piece", () => {
    const r = buildPrintReadiness(box(v(0, 0, 0), v(50, 50, 50)), BAMBU_A1, fmts);
    expect(r.grade).toBe("ready");
    expect(r.decompose.strategy).toBe("none");
    expect(r.formats).toHaveLength(3);
    expect(r.dimensions.w).toBeCloseTo(50);
    expect(r.narrative).toContain("mm");
    expect(r.bed.name).toBe("Bambu A1");
    expect(r.orientation).toBeDefined();
  });

  it("a too-big model is slab-split for the bed", () => {
    const r = buildPrintReadiness(box(v(0, 0, 0), v(300, 50, 50)), BAMBU_A1, fmts);
    expect(r.decompose.strategy).toBe("slab");
    expect(r.decompose.parts).toBeGreaterThan(1);
  });

  it("reports a repair for a non-watertight mesh", () => {
    const r = buildPrintReadiness(box(v(0, 0, 0), v(50, 50, 50)).slice(0, 10), BAMBU_A1, fmts);
    expect(r.repairs.some((x) => x.id === "weld")).toBe(true);
  });
});
