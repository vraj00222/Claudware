import { describe, it, expect } from "vitest";
import { parseStlBinary, parseStlAuto, boundingBox } from "@/server/printPlan";

/** Build a minimal binary STL (80-byte header, uint32 count, 50 bytes/triangle). */
function binStl(tris: number[][][]): Buffer {
  const buf = Buffer.alloc(84 + tris.length * 50);
  buf.writeUInt32LE(tris.length, 80);
  let o = 84;
  for (const t of tris) {
    o += 12; // normal (zeros)
    for (const v of t) { buf.writeFloatLE(v[0], o); buf.writeFloatLE(v[1], o + 4); buf.writeFloatLE(v[2], o + 8); o += 12; }
    o += 2; // attribute byte count
  }
  return buf;
}

const TRI = [[[0, 0, 0], [10, 0, 0], [0, 20, 5]]];

describe("binary STL", () => {
  it("parses a binary STL into triangles", () => {
    const tris = parseStlBinary(binStl(TRI));
    expect(tris).toHaveLength(1);
    expect(tris[0][2]).toEqual({ x: 0, y: 20, z: 5 });
  });

  it("auto-detects binary vs ascii", () => {
    expect(parseStlAuto(binStl(TRI))).toHaveLength(1);
    const ascii = "solid x\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid x\n";
    expect(parseStlAuto(Buffer.from(ascii, "utf8"))).toHaveLength(1);
  });

  it("bbox from a parsed binary STL is correct", () => {
    const bb = boundingBox(parseStlAuto(binStl(TRI)));
    expect(bb.w).toBe(10); expect(bb.d).toBe(20); expect(bb.h).toBe(5);
  });
});
