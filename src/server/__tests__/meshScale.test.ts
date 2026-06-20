import { describe, it, expect } from "vitest";
import { scaleStlAsciiToHeight } from "../meshScale";
import { parseStlTriangles, boundingBox } from "../printPlan";

// a 10mm cube (z 0..10) in ascii STL
const cube = `solid c
facet normal 0 0 1
outer loop
vertex 0 0 10
vertex 10 0 10
vertex 10 10 10
endloop
endfacet
facet normal 0 0 -1
outer loop
vertex 0 0 0
vertex 10 10 0
vertex 10 0 0
endloop
endfacet
endsolid c`;

describe("scaleStlAsciiToHeight", () => {
  it("scales the Z height to the target mm", () => {
    const out = scaleStlAsciiToHeight(cube, 300);
    const bb = boundingBox(parseStlTriangles(out));
    expect(Math.round(bb.h)).toBe(300); // 10mm → 300mm
    expect(Math.round(bb.w)).toBe(300); // uniform scale
  });
  it("returns input unchanged for non-positive target", () => {
    expect(scaleStlAsciiToHeight(cube, 0)).toBe(cube);
  });
});
