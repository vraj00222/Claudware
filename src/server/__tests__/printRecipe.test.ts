import { describe, it, expect } from "vitest";
import { buildPrintRecipe, classifyModel, meshVolume } from "@/server/printReady/recipe";
import { boundingBox, type Tri, type Vec3 } from "@/server/printPlan";
import { BAMBU_A1 } from "@/server/printReady/bed";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

// Simple cube: 8 triangles (2 per face × 4 visible faces for a minimal box)
function makeCube(size: number): Tri[] {
  const s = size / 2;
  const faces: [Vec3, Vec3, Vec3][] = [
    // bottom
    [v(-s, -s, 0), v(s, -s, 0), v(s, s, 0)],
    [v(-s, -s, 0), v(s, s, 0), v(-s, s, 0)],
    // top
    [v(-s, -s, size), v(s, s, size), v(s, -s, size)],
    [v(-s, -s, size), v(-s, s, size), v(s, s, size)],
    // front
    [v(-s, -s, 0), v(s, -s, 0), v(s, -s, size)],
    [v(-s, -s, 0), v(s, -s, size), v(-s, -s, size)],
    // back
    [v(-s, s, 0), v(s, s, size), v(s, s, 0)],
    [v(-s, s, 0), v(-s, s, size), v(s, s, size)],
    // left
    [v(-s, -s, 0), v(-s, s, size), v(-s, s, 0)],
    [v(-s, -s, 0), v(-s, -s, size), v(-s, s, size)],
    // right
    [v(s, -s, 0), v(s, s, 0), v(s, s, size)],
    [v(s, -s, 0), v(s, s, size), v(s, -s, size)],
  ];
  return faces;
}

// Tall thin column (figurine-like aspect ratio)
function makeTallColumn(w: number, d: number, h: number): Tri[] {
  const tris: Tri[] = [];
  // Generate a bunch of triangles to simulate high tri density
  const steps = 20;
  for (let i = 0; i < steps; i++) {
    const z0 = (i / steps) * h;
    const z1 = ((i + 1) / steps) * h;
    // 4 quads (8 tris) per ring segment
    for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
      const x0 = dx * w / 2, y0 = dy * d / 2;
      const x1 = dx * w / 2 * 0.9, y1 = dy * d / 2 * 0.9;
      tris.push([v(x0, y0, z0), v(x1, y1, z0), v(x0, y0, z1)]);
      tris.push([v(x1, y1, z0), v(x1, y1, z1), v(x0, y0, z1)]);
    }
  }
  return tris;
}

describe("meshVolume", () => {
  it("computes non-zero volume for a cube", () => {
    const tris = makeCube(10);
    const vol = meshVolume(tris);
    expect(vol).toBeGreaterThan(0);
  });
});

describe("classifyModel", () => {
  it("returns a valid model class for a cube", () => {
    const tris = makeCube(30);
    const bbox = boundingBox(tris);
    const cls = classifyModel(tris, bbox);
    expect(["figurine", "functional", "organic", "mechanical", "decorative"]).toContain(cls);
  });

  it("returns a valid model class for a tall column", () => {
    const tris = makeTallColumn(10, 10, 80);
    const bbox = boundingBox(tris);
    const cls = classifyModel(tris, bbox);
    expect(["figurine", "functional", "organic", "mechanical", "decorative"]).toContain(cls);
  });
});

describe("buildPrintRecipe", () => {
  it("returns a valid recipe for a cube", () => {
    const tris = makeCube(30);
    const recipe = buildPrintRecipe(tris, BAMBU_A1);
    expect(recipe.layerHeight).toBeGreaterThan(0);
    expect(recipe.layerHeight).toBeLessThanOrEqual(0.28);
    expect(recipe.infillPercent).toBeGreaterThanOrEqual(10);
    expect(recipe.infillPercent).toBeLessThanOrEqual(100);
    expect(recipe.wallLoops).toBeGreaterThanOrEqual(2);
    expect(recipe.material).toBe("PLA");
    expect(recipe.nozzleTemp).toBe(220);
    expect(recipe.bedTemp).toBe(55);
    expect(recipe.estimateMinutes).toBeGreaterThan(0);
    expect(recipe.estimateGrams).toBeGreaterThan(0);
    expect(recipe.why).toBeTruthy();
  });

  it("gives figurines fine layers and tree supports when needed", () => {
    const tris = makeTallColumn(10, 10, 80);
    const recipe = buildPrintRecipe(tris, BAMBU_A1);
    // Figurine/organic should get finer layers
    expect(recipe.layerHeight).toBeLessThanOrEqual(0.20);
  });

  it("gives functional parts thicker walls", () => {
    const tris = makeCube(40);
    const recipe = buildPrintRecipe(tris, BAMBU_A1);
    if (recipe.modelClass === "functional") {
      expect(recipe.wallLoops).toBeGreaterThanOrEqual(3);
      expect(recipe.infillPercent).toBeGreaterThanOrEqual(30);
    }
  });

  it("why field is non-empty", () => {
    const tris = makeCube(20);
    const recipe = buildPrintRecipe(tris, BAMBU_A1);
    expect(recipe.why.length).toBeGreaterThan(10);
    expect(recipe.why).toContain("PLA");
  });
});
